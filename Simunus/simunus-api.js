/* ============================================================
   SIMUNUS API — camada de RPCs Supabase
   ============================================================ */
(function () {
    const client = window.SimunusSupabase?.client || null;

    const errorMessages = {
        "Authentication required": {
            pt: "Faça login para continuar.",
            es: "Inicia sesión para continuar.",
            en: "Sign in to continue."
        },
        "Active Simunus access required": {
            pt: "Seu acesso ao Simunus não está ativo.",
            es: "Tu acceso a Simunus no está activo.",
            en: "Your Simunus access is not active."
        },
        "Simulation not found or unavailable": {
            pt: "Este simulado não está disponível.",
            es: "Este simulado no está disponible.",
            en: "This simulation is not available."
        },
        "Attempt not found": {
            pt: "Tentativa não encontrada.",
            es: "Intento no encontrado.",
            en: "Attempt not found."
        },
        "Attempt is not in progress": {
            pt: "Esta tentativa não está mais em andamento.",
            es: "Este intento ya no está en curso.",
            en: "This attempt is no longer in progress."
        },
        "Attempt is not submitted": {
            pt: "Finalize a tentativa para ver o resultado.",
            es: "Finaliza el intento para ver el resultado.",
            en: "Submit the attempt to see the result."
        },
        "Feedback unavailable until attempt submission": {
            pt: "O feedback estará disponível após finalizar a prova.",
            es: "La retroalimentación estará disponible después de finalizar la prueba.",
            en: "Feedback will be available after submitting the exam."
        },
        "Question must be answered before feedback": {
            pt: "Responda à questão para ver o feedback.",
            es: "Responde la pregunta para ver la retroalimentación.",
            en: "Answer the question to see feedback."
        },
        "SESSION_REPLACED": {
            pt: "Sua sessão foi aberta em outro dispositivo. Entre novamente para continuar.",
            es: "Tu sesión se abrió en otro dispositivo. Inicia sesión nuevamente para continuar.",
            en: "Your session was opened on another device. Sign in again to continue."
        }
    };

    function currentLanguage() {
        return document.documentElement.lang === "es"
            ? "es"
            : document.documentElement.lang === "en"
                ? "en"
                : "pt-BR";
    }

    function friendlyMessage(error, language = currentLanguage()) {
        const message = error?.message || String(error || "");
        const known = errorMessages[message];

        if (known) {
            return known[language] || known.pt;
        }

        if (/SESSION_REPLACED/i.test(message)) {
            return errorMessages.SESSION_REPLACED[language]
                || errorMessages.SESSION_REPLACED.pt;
        }

        if (/JWT|auth|session/i.test(message)) {
            return errorMessages["Authentication required"][language]
                || errorMessages["Authentication required"].pt;
        }

        return language === "en"
            ? "We could not complete this action. Please try again."
            : language === "es"
                ? "No fue posible completar esta acción. Inténtalo nuevamente."
                : "Não foi possível concluir esta ação. Tente novamente.";
    }

    function errorCode(error) {
        const message = error?.message || String(error || "");

        if (message === "Active Simunus access required") {
            return "access-required";
        }

        if (
            message === "SESSION_REPLACED"
            || /SESSION_REPLACED/i.test(message)
        ) {
            return "session-replaced";
        }

        if (
            message === "Authentication required"
            || /JWT|auth|session/i.test(message)
        ) {
            return "auth-required";
        }

        return "unknown";
    }

    async function rpc(name, params = {}) {
        if (!client) {
            throw new Error("Supabase client is not configured");
        }

        const { data, error } = await client.rpc(name, params);

        if (error) {
            if (errorCode(error) === "session-replaced") {
                window.dispatchEvent(new CustomEvent("simunus:session-replaced"));
            }
            throw error;
        }

        return data;
    }

    const api = {
        isReady: () => Boolean(client),

        friendlyMessage,

        errorCode,

        getMyAccessStatus: () => rpc("get_my_access_status"),

        getMyPreferredLanguage: () => rpc("get_my_preferred_language"),

        setMyPreferredLanguage: (language) =>
            rpc("set_my_preferred_language", { requested_language: language }),

        registerActiveSession: () =>
            rpc("register_active_session"),

        getAvailableSimulations: () =>
            rpc("get_available_simulations"),

        getCustomSimulationCatalog: () =>
            rpc("get_custom_simulation_catalog"),

        getInProgressAttempt: (simulationId) =>
            rpc("get_in_progress_attempt", {
                target_simulation_id: simulationId
            }),

        startSimulationAttempt: (simulationId, mode) =>
            rpc("start_simulation_attempt", {
                target_simulation_id: simulationId,
                requested_mode: mode
            }),

        startCustomSimulationAttempt: (
            areaIds,
            specialtyIds,
            topicIds,
            subtopicIds,
            questionCount,
            mode
        ) =>
            rpc("start_custom_simulation_attempt", {
                target_area_ids: areaIds ?? null,
                target_specialty_ids: specialtyIds ?? null,
                target_topic_ids: topicIds ?? null,
                target_subtopic_ids: subtopicIds ?? null,
                target_question_count: questionCount,
                requested_mode: mode
            }),

        startOrResumeAcademicPhase: (topicId) =>
            rpc("start_or_resume_academic_phase", { target_topic_id: topicId }),

        getMyLastActivity: () =>
            rpc("get_my_last_activity"),

        recordMyAttemptActivity: (attemptId) =>
            rpc("record_my_attempt_activity", { target_attempt_id: attemptId }),

        getSimulationAttempt: (attemptId, language) =>
            rpc("get_simulation_attempt", {
                target_attempt_id: attemptId,
                requested_language: language
            }),

        getAttemptQuestionOptions: (attemptQuestionId, language) =>
            rpc("get_attempt_question_options", {
                target_attempt_question_id: attemptQuestionId,
                requested_language: language
            }),

        submitAttemptAnswer: (
            attemptQuestionId,
            optionId,
            timeSpentSeconds
        ) =>
            rpc("submit_attempt_answer", {
                target_attempt_question_id: attemptQuestionId,
                target_option_id: optionId,
                target_time_spent_seconds:
                    Number.isInteger(timeSpentSeconds)
                    && timeSpentSeconds >= 0
                        ? timeSpentSeconds
                        : null
            }),

        getAttemptQuestionFeedback: (
            attemptQuestionId,
            language
        ) =>
            rpc("get_attempt_question_feedback", {
                target_attempt_question_id: attemptQuestionId,
                requested_language: language
            }),

        finishSimulationAttempt: (attemptId) =>
            rpc("finish_simulation_attempt", {
                target_attempt_id: attemptId
            }),

        getAttemptResult: (attemptId) =>
            rpc("get_attempt_result", {
                target_attempt_id: attemptId
            }),

        getAttemptReview: (attemptId, language) =>
            rpc("get_attempt_review", {
                target_attempt_id: attemptId,
                requested_language: language
            }),

        getMySimulationAttempts: () =>
            rpc("get_my_simulation_attempts"),

        getMyStudyDashboard: () =>
            rpc("get_my_study_dashboard"),

        getAttemptQuestionIdentity: (attemptQuestionId) =>
            rpc("get_attempt_question_identity", {
                target_attempt_question_id: attemptQuestionId
            }),

        addQuestionBookmark: (attemptQuestionId) =>
            rpc("add_question_bookmark", {
                target_attempt_question_id: attemptQuestionId
            }),

        removeQuestionBookmark: (questionId) =>
            rpc("remove_question_bookmark", {
                target_question_id: questionId
            }),

        getMyBookmarkedQuestions: (limit = 50, offset = 0) =>
            rpc("get_my_bookmarked_questions", {
                requested_limit: limit,
                requested_offset: offset
            }),

        getMyReviewCounts: () => rpc("get_my_review_counts"),

        startReviewAttempt: (reviewType, selectionMode, questionCount = null) =>
            rpc("start_review_attempt", {
                target_review_type: reviewType,
                target_selection_mode: selectionMode,
                target_question_count: questionCount
            })
    };

    window.SimunusApi = Object.freeze(api);
})();