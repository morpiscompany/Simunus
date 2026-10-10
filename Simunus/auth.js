/* ============================================================
   CONTROLE DE ACESSO — Supabase Auth
   ============================================================ */
(function () {
    const client = window.SimunusSupabase?.client || null;
    let currentEmail = null;

    function normalizeEmail(value) {
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function mapAuthError(error) {
        const message = error?.message || "";
        if (!client) return "load-error";
        if (/invalid login credentials/i.test(message)) return "invalid-credentials";
        if (/email not confirmed/i.test(message)) return "email-not-confirmed";
        if (/rate limit|too many/i.test(message)) return "rate-limited";
        if (/already registered|already exists|user already/i.test(message)) return "email-already-registered";
        if (/password/i.test(message)) return "weak-password";
        return "load-error";
    }

    function sessionResult(session) {
        const email = normalizeEmail(session?.user?.email);
        return email ? { ok: true, email, user: session.user } : { ok: false, code: "no-session" };
    }

    async function registerActiveSession() {
        if (!window.SimunusApi?.registerActiveSession) return { ok: false, code: "load-error" };
        try {
            await window.SimunusApi.registerActiveSession();
            return { ok: true };
        } catch (error) {
            console.error("Falha ao registrar sessão ativa:", error);
            const message = error?.message || "";
            return { ok: false, code: /SESSION_REPLACED/i.test(message) ? "session-replaced" : "load-error" };
        }
    }

    async function authenticate(email, password) {
        currentEmail = null;
        const normalized = normalizeEmail(email);
        if (!normalized) return { ok: false, code: "empty" };
        if (!isValidEmail(normalized)) return { ok: false, code: "invalid" };
        if (!password) return { ok: false, code: "empty-password" };
        if (!client) return { ok: false, code: "load-error" };

        const { data, error } = await client.auth.signInWithPassword({ email: normalized, password });
        if (error) {
            console.error("Falha no login Supabase:", error);
            return { ok: false, code: mapAuthError(error) };
        }
        const activeSession = await registerActiveSession();
        if (!activeSession.ok) return activeSession;
        currentEmail = normalizeEmail(data.session?.user?.email) || null;
        return sessionResult(data.session);
    }

    async function signUp(email, password) {
        currentEmail = null;
        const normalized = normalizeEmail(email);
        if (!normalized) return { ok: false, code: "empty" };
        if (!isValidEmail(normalized)) return { ok: false, code: "invalid" };
        if (!password) return { ok: false, code: "empty-password" };
        if (password.length < 6) return { ok: false, code: "weak-password" };
        if (!client) return { ok: false, code: "load-error" };

        const { data, error } = await client.auth.signUp({ email: normalized, password });
        if (error) {
            console.error("Falha ao criar conta Supabase:", error);
            return { ok: false, code: mapAuthError(error) };
        }
        if (data.session) {
            const activeSession = await registerActiveSession();
            if (!activeSession.ok) return activeSession;
            currentEmail = normalizeEmail(data.session?.user?.email) || null;
            return sessionResult(data.session);
        }
        return { ok: true, code: "signup-confirm-email", email: normalized, needsConfirmation: true };
    }

    async function initializeSession() {
        currentEmail = null;
        if (!client) return { ok: false, code: "load-error" };
        const { data, error } = await client.auth.getSession();
        if (error) {
            console.error("Falha ao restaurar sessão Supabase:", error);
            return { ok: false, code: "load-error" };
        }
        if (data.session) {
            const activeSession = await registerActiveSession();
            if (!activeSession.ok) { currentEmail = null; return activeSession; }
        }
        currentEmail = normalizeEmail(data.session?.user?.email) || null;
        return sessionResult(data.session);
    }

    async function clearSession() {
        currentEmail = null;
        if (!client) return;
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) console.warn("Não foi possível encerrar a sessão Supabase.", error);
    }

    function getCurrentEmail() {
        return currentEmail;
    }

    window.Auth = Object.freeze({ authenticate, signUp, initializeSession, logout: clearSession, normalizeEmail, isValidEmail, getCurrentEmail });
})();
