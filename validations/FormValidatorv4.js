/**
 * @class FormValidator
 * @version 3.1
 * @description Validador de formulários production-grade com revalidação forçada
 * na submissão e gerenciamento de estado de carregamento.
 */
class FormValidator {
    #formElement;
    #rules;
    #options;
    #submitButton;
    #originalSubmitButtonText;
    #isSubmitting = false;

    #fieldStates = new Map();
    #debounceTimers = {};
    #abortControllers = new Map();
    #validationCache = new Map();
    #debounceTimeout = 500;
    #cacheTTL = 30000;

    constructor(form, rules, options = {}) {
        const formEl = typeof form === 'string' ? document.querySelector(form) : form;
        if (!(formEl instanceof HTMLFormElement)) {
            throw new Error('FormValidator Error: O elemento fornecido não é um formulário válido.');
        }
        this.#formElement = formEl;
        this.#rules = rules;
        this.#options = options;
        this.#submitButton = this.#formElement.querySelector('[type="submit"]');

        if (this.#submitButton) {
            this.#originalSubmitButtonText = this.#submitButton.textContent;
        }
        if (options.debounceTimeout) this.#debounceTimeout = options.debounceTimeout;
        if (options.cacheTTL) this.#cacheTTL = options.cacheTTL;
    }

    init() {
        this.#formElement.setAttribute('novalidate', 'true');
        Object.keys(this.#rules).forEach(fieldName => {
            const fieldElement = this.#formElement.elements[fieldName];
            if (fieldElement) {
                this.#fieldStates.set(fieldName, { isValid: false, message: null });
                fieldElement.addEventListener('input', () => this.#handleValidation(fieldName));
            }
        });
        this.#updateFormState();
        this.#formElement.addEventListener('submit', this.#handleSubmit.bind(this));
    }

    /**
     * Utilitário para submeter os dados do formulário para uma API.
     * Usa a API Fetch e FormData, tratando corretamente o envio de arquivos.
     * Este método é opcional e deve ser chamado de dentro do callback 'onValidSubmit'.
     * @param {string} url - A URL do endpoint da API para onde os dados serão enviados.
     * @param {object} [fetchOptions={}] - Opções customizadas para a chamada fetch (ex: method, headers).
     * @returns {Promise<Response>} - A promessa que resolve para o objeto Response da API Fetch.
     */
    async submit(url, fetchOptions = {}) {
        if (!this.#formElement) {
            throw new Error('FormValidator: O formulário não está disponível para submissão.');
        }

        const formData = new FormData(this.#formElement);

        // Opções padrão da requisição
        const defaultOptions = {
            method: 'POST',
            body: formData,
            // IMPORTANTE: Não defina o cabeçalho 'Content-Type' manualmente.
            // O navegador o definirá como 'multipart/form-data' com o 'boundary' correto
            // automaticamente quando o corpo da requisição é um objeto FormData.
        };

        const options = {
            ...defaultOptions,
            ...fetchOptions,
        };

        return fetch(url, options);
    }

    async #handleSubmit(event) {
        event.preventDefault();
        if (this.#isSubmitting) return;

        this.#isSubmitting = true;
        this.#setSubmitButtonState('loading');

        try {
            const isFormValid = await this.validateForm({ force: true });
            if (isFormValid) {
                this.#options.onValidSubmit?.(Object.fromEntries(new FormData(this.#formElement)));
            } else {
                const errors = Array.from(this.#fieldStates.values())
                    .filter(state => !state.isValid && state.message)
                    .map(state => ({ fieldName: state.fieldName, message: state.message }));
                this.#options.onInvalidSubmit?.(errors);
            }
        } finally {
            this.#isSubmitting = false;
            this.#updateFormState();
        }
    }

    #handleValidation(fieldName) {
        clearTimeout(this.#debounceTimers[fieldName]);
        this.#debounceTimers[fieldName] = setTimeout(async () => {
            await this.validateField(fieldName);
        }, this.#debounceTimeout);
    }


    async validateField(fieldName, options = {}) {
        const { force = false } = options;
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return true;

        const cacheKey = `${fieldName}:${fieldElement.value}`;
        if (!force && this.#validationCache.has(cacheKey)) {
            const cached = this.#validationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.#cacheTTL) {
                cached.isValid ? this.#clearFieldError(fieldName) : this.#setFieldError(fieldName, cached.message);
                return cached.isValid;
            }
        }

        this.#abortControllers.get(fieldName)?.abort();
        const controller = new AbortController();
        this.#abortControllers.set(fieldName, controller);

        const validationContext = {
            value: fieldElement.value,
            files: fieldElement.files,
            elements: this.#formElement.elements,
            signal: controller.signal,
            form: this.#formElement
        };

        try {
            for (const rule of this.#rules[fieldName]) {
                const isValid = await Promise.resolve(rule.validate(validationContext.value, validationContext));
                if (controller.signal.aborted) throw new Error('Aborted');

                if (!isValid) {
                    throw { isValidationError: true, message: rule.message };
                }
            }

            this.#clearFieldError(fieldName);
            this.#validationCache.set(cacheKey, { isValid: true, message: null, timestamp: Date.now() });
            return true;

        } catch (error) {
            if (error.name === 'AbortError' || error.message === 'Aborted') {
                return this.#fieldStates.get(fieldName)?.isValid || false;
            }
            if (error.isValidationError) {
                this.#setFieldError(fieldName, error.message);
                this.#validationCache.set(cacheKey, { isValid: false, message: error.message, timestamp: Date.now() });
            } else {
                console.error(`Erro inesperado na validação de ${fieldName}:`, error);
                this.#setFieldError(fieldName, 'Ocorreu um erro inesperado.');
            }
            return false;
        } finally {
            this.#abortControllers.delete(fieldName);
            this.#updateFormState();
        }
    }

    async validateForm(options = {}) {
        const promises = Object.keys(this.#rules).map(fieldName => this.validateField(fieldName, options));
        const results = await Promise.all(promises);
        return results.every(res => res);
    }

    #setFieldError(fieldName, message) {
        this.#fieldStates.set(fieldName, { isValid: false, message, fieldName });
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return;
        const group = fieldElement.closest('.form-group');
        if (!group) return;
        group.classList.add('error');
        let errorEl = group.querySelector('.error-message');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            group.appendChild(errorEl);
        }
        errorEl.textContent = message;
    }

    #clearFieldError(fieldName) {
        this.#fieldStates.set(fieldName, { isValid: true, message: null, fieldName });
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return;
        const group = fieldElement.closest('.form-group');
        if (!group) return;
        group.classList.remove('error');
        group.querySelector('.error-message')?.remove();
    }

    #setSubmitButtonState(state) {
        if (!this.#submitButton) return;
        switch (state) {
            case 'loading':
                this.#submitButton.disabled = true;
                this.#submitButton.textContent = 'Carregando...';
                break;
            case 'disabled':
                this.#submitButton.disabled = true;
                this.#submitButton.textContent = this.#originalSubmitButtonText;
                break;
            case 'default':
                this.#submitButton.disabled = false;
                this.#submitButton.textContent = this.#originalSubmitButtonText;
                break;
        }
    }

    #updateFormState() {
        if (!this.#submitButton || this.#isSubmitting) return;
        const isFormValid = Array.from(this.#fieldStates.values()).every(s => s.isValid);
        this.#setSubmitButtonState(isFormValid ? 'default' : 'disabled');
    }
}