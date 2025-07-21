/**
 * @class FormValidator
 * @version 3.0
 * @description Validador avançado de formulários com suporte a:
 * - Validações síncronas e assíncronas
 * - Cancelamento de operações pendentes
 * - Cache de validações
 * - Dependência entre campos (dependsOn)
 * - Eventos customizados
 */
class FormValidator {
    #formElement;
    #rules;
    #options;
    #submitButton;

    #fieldStates = new Map();
    #debounceTimers = {};
    #abortControllers = new Map();
    #validationCache = new Map();
    #dirtyFields = new Set();
    #debounceTimeout = 500;
    #cacheTTL = 30000;

    constructor(form, rules, options = {}) {
        const formEl = typeof form === 'string' ? document.querySelector(form) : form;
        if (!(formEl instanceof HTMLFormElement)) {
            throw new Error('FormValidator Error: O elemento fornecido não é um formulário válido.');
        }

        this.#formElement = formEl;
        this.#rules = this.#normalizeRules(rules);
        this.#options = options;
        this.#submitButton = this.#formElement.querySelector('[type="submit"]');
        
        if (options.cacheTTL) this.#cacheTTL = options.cacheTTL;
        if (options.debounceTimeout) this.#debounceTimeout = options.debounceTimeout;
    }

    #normalizeRules(rules) {
        return Object.entries(rules).reduce((acc, [fieldName, fieldRules]) => {
            acc[fieldName] = fieldRules.map(rule => ({
                validate: rule.validate,
                message: rule.message,
                dependsOn: rule.dependsOn || []
            }));
            return acc;
        }, {});
    }

    init() {
        this.#formElement.setAttribute('novalidate', 'true');
        
        Object.keys(this.#rules).forEach(fieldName => {
            const fieldElement = this.#formElement.elements[fieldName];
            if (fieldElement) {
                this.#fieldStates.set(fieldName, { isValid: false, message: null });
                
                fieldElement.addEventListener('input', () => {
                    this.#handleValidation(fieldName);
                    this.#markAsDirty(fieldName);
                });
                
                fieldElement.addEventListener('blur', () => {
                    this.#handleValidation(fieldName, false);
                });
            }
        });

        this.#setupDependencyListeners();
        this.#updateFormState();
        this.#formElement.addEventListener('submit', this.#handleSubmit.bind(this));
    }

    #setupDependencyListeners() {
        const dependencyMap = new Map();

        Object.entries(this.#rules).forEach(([fieldName, fieldRules]) => {
            fieldRules.forEach(rule => {
                if (rule.dependsOn && rule.dependsOn.length) {
                    rule.dependsOn.forEach(depName => {
                        if (!dependencyMap.has(depName)) {
                            dependencyMap.set(depName, new Set());
                        }
                        dependencyMap.get(depName).add(fieldName);
                    });
                }
            });
        });

        dependencyMap.forEach((dependentFields, sourceField) => {
            const sourceElement = this.#formElement.elements[sourceField];
            if (sourceElement) {
                sourceElement.addEventListener('input', () => {
                    dependentFields.forEach(fieldName => {
                        this.#handleValidation(fieldName, true);
                    });
                });
            }
        });
    }

    #markAsDirty(fieldName) {
        this.#dirtyFields.add(fieldName);
    }

    async #handleSubmit(event) {
        event.preventDefault();
        const isFormValid = await this.validateForm();

        if (isFormValid) {
            this.#emit('validSubmit');
            if (typeof this.#options.onValidSubmit === 'function') {
                const formData = Object.fromEntries(new FormData(this.#formElement));
                this.#options.onValidSubmit(formData);
            }
        } else {
            this.#emit('invalidSubmit');
            if (typeof this.#options.onInvalidSubmit === 'function') {
                const errors = Array.from(this.#fieldStates.values())
                    .filter(state => !state.isValid && state.message)
                    .map(state => ({ fieldName: state.fieldName, message: state.message }));
                this.#options.onInvalidSubmit(errors);
            }
        }
    }

    #handleValidation(fieldName, useDebounce = true) {
        clearTimeout(this.#debounceTimers[fieldName]);
        
        if (useDebounce) {
            this.#debounceTimers[fieldName] = setTimeout(async () => {
                await this.validateField(fieldName);
            }, this.#debounceTimeout);
        } else {
            this.validateField(fieldName);
        }
    }

    async validateField(fieldName) {
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return true;

        if (this.#abortControllers.has(fieldName)) {
            this.#abortControllers.get(fieldName).abort();
        }

        const cacheKey = `${fieldName}:${fieldElement.value}`;
        if (this.#validationCache.has(cacheKey)) {
            const { isValid, message, timestamp } = this.#validationCache.get(cacheKey);
            if (Date.now() - timestamp < this.#cacheTTL) {
                if (!isValid) this.#setFieldError(fieldName, message);
                else this.#clearFieldError(fieldName);
                return isValid;
            }
        }

        const controller = new AbortController();
        this.#abortControllers.set(fieldName, controller);

        try {
            for (const rule of this.#rules[fieldName]) {
                if (rule.dependsOn && rule.dependsOn.length) {
                    const shouldSkip = !rule.dependsOn.every(dep => 
                        this.#fieldStates.get(dep)?.isValid ?? false
                    );
                    
                    if (shouldSkip) {
                        this.#clearFieldError(fieldName);
                        continue;
                    }
                }

                const validationContext = {
                    value: fieldElement.value,
                    elements: this.#formElement.elements,
                    signal: controller.signal,
                    form: this.#formElement
                };

                let isValid;
                try {
                    isValid = rule.validate(validationContext.value, validationContext);
                    if (isValid instanceof Promise) isValid = await isValid;
                } catch (error) {
                    if (error.name !== 'AbortError') throw error;
                    return false;
                }

                if (!isValid) {
                    throw new Error(rule.message);
                }
            }

            this.#clearFieldError(fieldName);
            this.#validationCache.set(cacheKey, { 
                isValid: true, 
                message: null, 
                timestamp: Date.now() 
            });
            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.#setFieldError(fieldName, error.message);
                this.#validationCache.set(cacheKey, { 
                    isValid: false, 
                    message: error.message, 
                    timestamp: Date.now() 
                });
            }
            return false;
        } finally {
            this.#abortControllers.delete(fieldName);
            this.#updateFormState();
        }
    }

    async validateForm() {
        const validationPromises = Object.keys(this.#rules).map(fieldName => 
            this.validateField(fieldName)
        );
        const results = await Promise.all(validationPromises);
        return results.every(isValid => isValid);
    }

    #setFieldError(fieldName, message) {
        this.#fieldStates.set(fieldName, { isValid: false, message, fieldName });
        
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return;

        const formGroup = fieldElement.closest('.form-group') || fieldElement.parentElement;
        if (!formGroup) return;

        formGroup.classList.add('error');
        let errorContainer = formGroup.querySelector('.error-message');
        
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            formGroup.appendChild(errorContainer);
        }
        
        errorContainer.textContent = message;
        this.#emit('fieldError', { fieldName, message, element: fieldElement });
    }

    #clearFieldError(fieldName) {
        this.#fieldStates.set(fieldName, { isValid: true, message: null, fieldName });
        
        const fieldElement = this.#formElement.elements[fieldName];
        if (!fieldElement) return;

        const formGroup = fieldElement.closest('.form-group') || fieldElement.parentElement;
        if (!formGroup) return;

        formGroup.classList.remove('error');
        const errorContainer = formGroup.querySelector('.error-message');
        if (errorContainer) errorContainer.remove();
        
        this.#emit('fieldValid', { fieldName, element: fieldElement });
    }

    #updateFormState() {
        if (!this.#submitButton) return;

        const isFormValid = Array.from(this.#fieldStates.values())
            .every(state => state.isValid);

        this.#submitButton.disabled = !isFormValid;
        this.#emit('formStateChange', { isValid: isFormValid });
    }

    #emit(eventName, detail = {}) {
        this.#formElement.dispatchEvent(
            new CustomEvent(`formvalidator:${eventName}`, { 
                bubbles: true,
                detail: { ...detail, validator: this }
            })
        );
    }

    reset() {
        this.#validationCache.clear();
        this.#dirtyFields.clear();
        this.#abortControllers.forEach(ctrl => ctrl.abort());
        this.#abortControllers.clear();
        
        Object.keys(this.#rules).forEach(fieldName => {
            this.#clearFieldError(fieldName);
        });
        
        this.#updateFormState();
    }

    destroy() {
        this.#formElement.removeAttribute('novalidate');
        this.#formElement.removeEventListener('submit', this.#handleSubmit);
        
        Object.keys(this.#rules).forEach(fieldName => {
            const fieldElement = this.#formElement.elements[fieldName];
            if (fieldElement) {
                fieldElement.removeEventListener('input', this.#handleValidation);
                fieldElement.removeEventListener('blur', this.#handleValidation);
            }
        });
        
        this.reset();
    }
}