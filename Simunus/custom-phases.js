/* ============================================================
   MATÉRIAS PERSONALIZADAS — armazenamento local por conta
   ============================================================ */
(function () {
    "use strict";

    const LEGACY_BACKUP_KEY = "simunus-custom-phases-legacy-backup-v1";
    const STORAGE_KEY = "simulados-medicina-custom-phases-v1"; // Mantida para compatibilidade com versões anteriores.
    const api = {
        getAll,
        save,
        remove,
        duplicate,
        toggleFavorite,
        setArchived,
        reorder,
        getById,
        currentOwner,
        getAllSubjects: getAll,
        getSubjectById: getById,
        refreshFromSupabase,
        syncLegacyToSupabase
    };

    const client = window.SimunusSupabase?.client || null;
    let remoteQueue = Promise.resolve();
    let remoteOwner = null;
    let remoteReady = false;
    let localRevision = 0;
    let refreshGeneration = 0;

    function currentOwner() {
        try {
            return window.Auth?.getCurrentEmail?.() || "anonymous";
        } catch (_) { return "anonymous"; }
    }

    function readStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return data && typeof data === "object" && !Array.isArray(data) ? data : {};
        } catch (error) {
            console.warn("Fases personalizadas: armazenamento local indisponível.", error);
            return {};
        }
    }

    function writeStore(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localRevision++;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getAll() {
        const store = readStore();
        const owner = currentOwner();
        return Array.isArray(store[owner]) ? clone(store[owner]) : [];
    }

    function getById(id) {
        return getAll().find((phase) => phase.id === id) || null;
    }

    function normalizeQuestion(q) {
        const base = q && typeof q === "object" ? q : {};
        const arr = (v) => Array.isArray(v) ? v.filter((x) => String(x ?? "").trim()) : [];
        return {
            grupo: String(base.grupo ?? "").trim(),
            nome: String(base.nome ?? "").trim(),
            descricao: String(base.descricao ?? "").trim(),
            alvo: String(base.alvo ?? "").trim(),
            pergunta: String(base.pergunta ?? "").trim(),
            resposta: String(base.resposta ?? "").trim(),
            incompativeis: arr(base.incompativeis),
            grupoPT: String(base.grupoPT ?? base.grupo ?? "").trim(),
            nomePT: String(base.nomePT ?? base.nome ?? "").trim(),
            descricaoPT: String(base.descricaoPT ?? base.descricao ?? "").trim(),
            alvoPT: String(base.alvoPT ?? base.alvo ?? "").trim(),
            perguntaPT: String(base.perguntaPT ?? base.pergunta ?? "").trim(),
            respostaPT: String(base.respostaPT ?? base.resposta ?? "").trim(),
            incompativeisPT: arr(base.incompativeisPT ?? base.incompativeis)
        };
    }

    function normalizePhase(input) {
        const now = new Date().toISOString();
        const subject = input && typeof input === "object" ? clone(input) : {};
        const questions = Array.isArray(subject.questions) ? subject.questions.map(normalizeQuestion) : [];
        return {
            id: String(subject.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            name: String(subject.name || "").trim(),
            description: String(subject.description || "").trim(),
            category: String(subject.category || "custom").trim(), // legado; não determina a matéria.
            group: String(subject.group || subject.grupo || "").trim(),
            difficulty: String(subject.difficulty || "normal"),
            language: "bilíngue", // legado; não é uma configuração escolhida pelo usuário.
            questions,
            createdAt: subject.createdAt || now,
            updatedAt: now,
            owner: currentOwner(),
            favorite: Boolean(subject.favorite),
            archived: Boolean(subject.archived),
            sortOrder: Number.isFinite(Number(subject.sortOrder)) ? Number(subject.sortOrder) : Date.parse(subject.createdAt || now)
        };
    }

    // Writes are serialized per page. Local data remains as a recovery copy if the network fails.
    function queueRemote(action) {
        const owner = currentOwner();
        if (!client || !remoteReady || owner !== remoteOwner) return;
        remoteQueue = remoteQueue.then(async () => {
            if (currentOwner() !== owner) return;
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user || (user.email || "").toLowerCase() !== owner) throw authError || new Error("Sessão não corresponde ao proprietário");
            if (currentOwner() !== owner) return;
            const { error } = await action(user.id);
            if (error) throw error;
        }).catch((error) => {
            console.error("Falha ao sincronizar matéria personalizada; cópia local preservada:", error);
            remoteReady = false; // Prevent silent subsequent writes until a fresh successful refresh.
            window.dispatchEvent(new CustomEvent("simunus-custom-sync-error"));
        });
    }

    // Downloads existing remote records but does not upload old local data without user consent.
    async function refreshFromSupabase() {
        const generation = ++refreshGeneration;
        remoteReady = false;
        remoteOwner = null;
        const owner = currentOwner();
        if (!client || owner === "anonymous") return { ok: false, reason: "not-authenticated" };
        await remoteQueue;
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user || (user.email || "").toLowerCase() !== owner) return { ok: false, reason: "not-authenticated" };
        const revision = localRevision;
        const { data, error } = await client.from("user_custom_phases").select("phase_id,payload").eq("user_id", user.id);
        if (error) return { ok: false, reason: "remote-error", error };
        // A response started by a previous account must not enable writes for it.
        if (currentOwner() !== owner) return { ok: false, reason: "owner-changed" };
        if (generation !== refreshGeneration) return { ok: false, reason: "refresh-superseded" };
        if (revision !== localRevision) return { ok: false, reason: "local-changed" };
        const store = readStore();
        const existing = Array.isArray(store[owner]) ? store[owner] : [];
        // Server state is authoritative: local-only items must not reappear
        // after deletion from another device.
        const remotePhases = (data || [])
            .filter(row => row.payload && typeof row.payload === "object" && row.payload.id === row.phase_id)
            .map(row => row.payload);
        const remoteIds = new Set(remotePhases.map(phase => phase.id));
        const localOnly = existing.filter(phase => !remoteIds.has(phase.id));
        const remoteById = new Map(remotePhases.map(phase => [phase.id, phase]));
        const divergent = existing.filter(phase => !remoteById.has(phase.id) || JSON.stringify(phase) !== JSON.stringify(remoteById.get(phase.id)));
        if (divergent.length) {
            // Preserve every divergent local snapshot, but do not display or re-upload
            // it without an explicit user review of the backup.
            try {
                const backups = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY) || "{}");
                const prior = Array.isArray(backups[owner]) ? backups[owner] : [];
                const snapshots = new Map(prior.map(phase => [JSON.stringify(phase), phase]));
                divergent.forEach(phase => snapshots.set(JSON.stringify(phase), phase));
                backups[owner] = [...snapshots.values()];
                localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(backups));
            } catch (backupError) {
                console.error("Não foi possível preservar as fases locais:", backupError);
                return { ok: false, reason: "legacy-backup-error", error: backupError };
            }
        }
        store[owner] = remotePhases;
        writeStore(store);
        remoteOwner = owner;
        remoteReady = true;
        return { ok: true, localLegacyCount: localOnly.length };
    }

    // Explicit opt-in migration only: call from a user-confirmed import flow, not during login.
    async function syncLegacyToSupabase() {
        // Unmatched records may include previously deleted phases.
        // An explicit per-item review/import UI is required before restoration.
        return { ok: false, reason: "legacy-review-required" };
    }

    function save(input) {
        const phase = normalizePhase(input);
        const store = readStore();
        const owner = currentOwner();
        const list = Array.isArray(store[owner]) ? store[owner] : [];
        const index = list.findIndex((item) => item.id === phase.id);
        if (index >= 0) list[index] = phase;
        else {
            phase.sortOrder = list.reduce((max, item) => Math.max(max, Number(item.sortOrder) || 0), 0) + 1;
            list.push(phase);
        }
        store[owner] = list;
        writeStore(store);
        const snapshot = clone(phase);
        queueRemote(userId => client.from("user_custom_phases").upsert({user_id: userId, phase_id: snapshot.id, payload: snapshot}, {onConflict: "user_id,phase_id"}));
        return snapshot;
    }

    function remove(id) {
        const store = readStore();
        const owner = currentOwner();
        const list = Array.isArray(store[owner]) ? store[owner] : [];
        store[owner] = list.filter((phase) => phase.id !== id);
        writeStore(store);
        queueRemote(userId => client.from("user_custom_phases").delete().eq("user_id", userId).eq("phase_id", id));
    }

    function duplicate(id) {
        const original = getById(id);
        if (!original) return null;
        const copy = clone(original);
        copy.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        copy.name = `${original.name} (cópia)`;
        copy.favorite = false;
        copy.archived = false;
        copy.createdAt = new Date().toISOString();
        copy.updatedAt = copy.createdAt;
        return save(copy);
    }

    function reorder(ids) {
        const current = getAll();
        const oldIds = current.map(item => item.id);
        if (ids.length !== oldIds.length || new Set(ids).size !== ids.length || ids.some(id => !oldIds.includes(id))) return false;
        const byId = new Map(current.map(item => [item.id, item]));
        ids.forEach((id, index) => {
            const item = byId.get(id);
            if (item.sortOrder !== index + 1) save({ ...item, sortOrder: index + 1 });
        });
        return true;
    }

    function setArchived(id, archived) {
        const phase = getById(id);
        if (!phase) return null;
        phase.archived = Boolean(archived);
        return save(phase);
    }

    function toggleFavorite(id) {
        const phase = getById(id);
        if (!phase) return null;
        phase.favorite = !phase.favorite;
        return save(phase);
    }

    window.CustomPhases = Object.freeze(api);
})();
