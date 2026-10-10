(function () {
    "use strict";

    const EYE = '<svg class="lucide lucide-eye" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const EYE_OFF = '<svg class="lucide lucide-eye-off" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.8 10.8 0 0 1-1.444 2.49"></path><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path><path d="m2 2 20 20"></path></svg>';

    function label(visible) {
        const lang = (document.documentElement.lang || navigator.language || "pt").toLowerCase();
        if (lang.startsWith("en")) return visible ? "Hide password" : "Show password";
        if (lang.startsWith("es")) return visible ? "Ocultar contraseña" : "Mostrar contraseña";
        return visible ? "Ocultar senha" : "Mostrar senha";
    }

    function render(button, input) {
        const visible = input.type === "text";
        const text = label(visible);
        button.setAttribute("aria-pressed", String(visible));
        button.setAttribute("aria-label", text);
        button.title = text;
        const icon = button.querySelector(".icone-visibilidade-senha");
        if (icon) icon.innerHTML = visible ? EYE : EYE_OFF;
    }

    document.addEventListener("click", function (event) {
        const button = event.target.closest(".alternar-visibilidade-senha");
        if (!button) return;
        event.preventDefault();
        const input = document.getElementById(button.dataset.passwordTarget);
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.type = input.type === "password" ? "text" : "password";
        render(button, input);
        input.focus({ preventScroll: true });
        try { if (start !== null && end !== null) input.setSelectionRange(start, end); } catch (_) {}
    });

    document.querySelectorAll(".alternar-visibilidade-senha").forEach(function (button) {
        const input = document.getElementById(button.dataset.passwordTarget);
        if (input) render(button, input);
    });
})();
