/**
 * @class FormValidator
 * @version 2.0
 * @description Orquestra a validação de formulários, gerenciando o estado do botão
 * de submit e fornecendo callbacks para a lógica de submissão.
 */
class FormValidator {
    #formElement;
    #rules;
    #submitButton;
    #callbacks;

    #fieldStates = new Map();
    #debounceTimers = {};
    #debounceTimeout = 500;

    /**
     * Cria uma instância do FormValidator.
     * @param {HTMLFormElement|string} form O elemento do formulário ou um seletor CSS.
     * @param {object} rules Um objeto de regras de validação.
     * @param {object} [options] Opções e callbacks.
     * @param {Function} [options.onValidSubmit] Callback para submissão válida. Recebe os dados do formulário.
     * @param {Function} [options.onInvalidSubmit] Callback para submissão inválida. Recebe um array de erros.
     */
    constructor(form, rules, options = {}) {
        const formEl = typeof form === 'string' ? document.querySelector(form) : form;
        if (!(formEl instanceof HTMLFormElement)) {
            throw new Error('FormValidator Error: O elemento fornecido não é um formulário válido.');
        }
        this.#formElement = formEl;
        this.#rules = rules;
        this.#callbacks = options;
        this.#submitButton = this.#formElement.querySelector('[type="submit"]');
    }

    /**
     * Inicializa o validador, anexando os listeners e configurando o estado inicial.
     */
    init() {
        this.#formElement.setAttribute('novalidate', 'true');
        
        // Inicializa o estado de todos os campos e anexa listeners
        Object.keys(this.#rules).forEach(fieldName => {
            const fieldElement = this.#formElement.elements[fieldName];
            if (fieldElement) {
                // Assume que os campos são inválidos até a primeira interação/validação.
                this.#fieldStates.set(fieldName, { isValid: false, message: null });
                fieldElement.addEventListener('input', () => this.#handleValidation(fieldName));
            }
        });
        
        this.#updateFormState(); // Atualiza o estado inicial do botão de submit

        this.#formElement.addEventListener('submit', this.#handleSubmit.bind(this));
    }

    async #handleSubmit(event) {
        event.preventDefault();
        const isFormValid = await this.validateForm();

        if (isFormValid) {
            if (typeof this.#callbacks.onValidSubmit === 'function') {
                const formData = Object.fromEntries(new FormData(this.#formElement));
                this.#callbacks.onValidSubmit(formData);
            }
        } else {
            if (typeof this.#callbacks.onInvalidSubmit === 'function') {
                const errors = Array.from(this.#fieldStates.values())
                    .filter(state => !state.isValid && state.message)
                    .map(state => ({ fieldName: state.fieldName, message: state.message }));
                this.#callbacks.onInvalidSubmit(errors);
            }
        }
    }
    
    #handleValidation(fieldName) {
        clearTimeout(this.#debounceTimers[fieldName]);
        this.#debounceTimers[fieldName] = setTimeout(async () => {
            await this.validateField(fieldName);
        }, this.#debounceTimeout);
    }
    
    async validateField(fieldName) {
        const fieldRules = this.#rules[fieldName] || [];
        const fieldElement = this.#formElement.elements[fieldName];
        
        for (const rule of fieldRules) {
            const isValid = await rule.validate(fieldElement.value, this.#formElement.elements);
            if (!isValid) {
                this.#setFieldError(fieldElement, fieldName, rule.message);
                this.#updateFormState();
                return false;
            }
        }
        
        this.#clearFieldError(fieldElement, fieldName);
        this.#updateFormState();
        return true;
    }

    async validateForm() {
        const validationPromises = Object.keys(this.#rules).map(fieldName => this.validateField(fieldName));
        const results = await Promise.all(validationPromises);
        return results.every(isValid => isValid);
    }
    
    #setFieldError(fieldElement, fieldName, message) {
        this.#fieldStates.set(fieldName, { isValid: false, message: message, fieldName: fieldName });
        const formGroup = fieldElement.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.add('error');
        let errorContainer = formGroup.querySelector('.error-message');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            formGroup.appendChild(errorContainer);
        }
        errorContainer.textContent = message;
    }

    #clearFieldError(fieldElement, fieldName) {
        this.#fieldStates.set(fieldName, { isValid: true, message: null, fieldName: fieldName });
        const formGroup = fieldElement.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.remove('error');
        const errorContainer = formGroup.querySelector('.error-message');
        if (errorContainer) errorContainer.remove();
    }
    
    /**
     * Avalia o estado geral do formulário e atualiza a UI (ex: botão de submit).
     * @private
     */
    #updateFormState() {
        if (!this.#submitButton) return;

        const isFormGloballyValid = Array.from(this.#fieldStates.values())
                                         .every(state => state.isValid);

        this.#submitButton.disabled = !isFormGloballyValid;
    }
}