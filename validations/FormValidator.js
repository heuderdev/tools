/**
 * @class FormValidator
 * @description Orquestra a validação de formulários complexos, com suporte
 * a regras síncronas, assíncronas (API calls) e feedback de UI reativo.
 */
class FormValidator {
    /**
     * O elemento do formulário a ser validado.
     * @type {HTMLFormElement}
     * @private
     */
    #formElement;

    /**
     * A configuração de regras de validação.
     * @type {object}
     * @private
     */
    #rules;

    /**
     * Armazena os timers de debounce para validações assíncronas.
     * @type {object}
     * @private
     */
    #debounceTimers = {};

    /**
     * O tempo de espera para o debounce em milissegundos.
     * @type {number}
     * @private
     */
    #debounceTimeout = 500;

    /**
     * Cria uma instância do FormValidator.
     * @param {HTMLFormElement|string} form - O elemento do formulário ou um seletor CSS.
     * @param {object} rules - Um objeto onde as chaves são os 'name' dos inputs
     * e os valores são arrays de objetos de regra { validate, message }.
     */
    constructor(form, rules) {
        const formEl = typeof form === 'string' ? document.querySelector(form) : form;
        if (!(formEl instanceof HTMLFormElement)) {
            throw new Error('FormValidator Error: O elemento fornecido não é um formulário válido.');
        }
        this.#formElement = formEl;
        this.#rules = rules;
    }

    /**
     * Inicializa o validador, anexando os listeners de evento aos campos.
     */
    init() {
        this.#formElement.setAttribute('novalidate', 'true'); // Desativa a validação nativa do browser

        Object.keys(this.#rules).forEach(fieldName => {
            const fieldElement = this.#formElement.elements[fieldName];
            if (fieldElement) {
                fieldElement.addEventListener('input', (e) => {
                    this.#handleValidation(e.target.name);
                });
            }
        });

        this.#formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const isFormValid = await this.validateForm();
            if (isFormValid) {
                console.log('Formulário válido. Enviando...');
                // this.#formElement.submit(); // Descomente para enviar o formulário
            } else {
                console.log('Formulário inválido. Corrija os erros.');
            }
        });
    }

    /**
     * Lida com a validação de um campo, aplicando debounce para regras assíncronas.
     * @param {string} fieldName - O nome do campo a ser validado.
     * @private
     */
    #handleValidation(fieldName) {
        if (this.#debounceTimers[fieldName]) {
            clearTimeout(this.#debounceTimers[fieldName]);
        }

        this.#debounceTimers[fieldName] = setTimeout(async () => {
            await this.validateField(fieldName);
        }, this.#debounceTimeout);
    }
    
    /**
     * Valida um único campo contra todas as suas regras.
     * @param {string} fieldName - O nome do campo a ser validado.
     * @returns {Promise<boolean>} - Retorna true se o campo for válido, senão false.
     */
    async validateField(fieldName) {
        const fieldRules = this.#rules[fieldName] || [];
        const fieldElement = this.#formElement.elements[fieldName];
        
        // Passa todos os elementos do formulário para o validador
        const formElements = this.#formElement.elements;

        for (const rule of fieldRules) {
            // A função de validação pode ser sync ou async
            const isValid = await rule.validate(fieldElement.value, formElements);
            if (!isValid) {
                this.#setFieldError(fieldElement, rule.message);
                return false;
            }
        }

        this.#clearFieldError(fieldElement);
        return true;
    }

    /**
     * Valida todos os campos do formulário.
     * @returns {Promise<boolean>} - Retorna true se o formulário inteiro for válido.
     */
    async validateForm() {
        const validationPromises = Object.keys(this.#rules).map(fieldName => this.validateField(fieldName));
        const results = await Promise.all(validationPromises);
        return results.every(isValid => isValid);
    }

    /**
     * Aplica o feedback visual de erro a um campo.
     * @param {HTMLElement} fieldElement - O elemento do input.
     * @param {string} message - A mensagem de erro.
     * @private
     */
    #setFieldError(fieldElement, message) {
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

    /**
     * Remove o feedback visual de erro de um campo.
     * @param {HTMLElement} fieldElement - O elemento do input.
     * @private
     */
    #clearFieldError(fieldElement) {
        const formGroup = fieldElement.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.remove('error');
        const errorContainer = formGroup.querySelector('.error-message');
        if (errorContainer) {
            errorContainer.remove();
        }
    }
}