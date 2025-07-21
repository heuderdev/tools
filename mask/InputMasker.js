/**
 * @class InputMasker
 * @description Aplica uma máscara de formatação a um campo de input em tempo real.
 * A classe é projetada para ser flexível e performática.
 */
class InputMasker {
    /**
     * O elemento de input do DOM a ser mascarado.
     * @type {HTMLInputElement}
     * @private
     */
    #inputElement;

    /**
     * O padrão da máscara a ser aplicado.
     * @type {string}
     * @private
     */
    #maskPattern;
    
    /**
     * O caractere usado no padrão para representar um espaço de entrada.
     * @type {string}
     * @private
     */
    #placeholderChar = '_';

    /**
     * Referência ao handler de evento com o 'this' corretamente vinculado.
     * @type {Function}
     * @private
     */
    #boundApplyMask;

    /**
     * Cria uma instância de InputMasker.
     * @param {HTMLInputElement|string} input - O elemento de input ou um seletor CSS.
     * @param {string} pattern - A string da máscara. Use '_' para representar os caracteres a serem digitados.
     * Ex: '___.___.___-__', '(__) _____-____', '__/__/____'
     */
    constructor(input, pattern) {
        const inputEl = typeof input === 'string' ? document.querySelector(input) : input;
        if (!(inputEl instanceof HTMLInputElement)) {
            throw new Error('InputMasker Error: O primeiro argumento deve ser um elemento de input válido ou um seletor.');
        }
        this.#inputElement = inputEl;
        this.#maskPattern = pattern;
        
        // Armazena a função com o contexto correto para poder removê-la posteriormente.
        this.#boundApplyMask = this.#applyMask.bind(this);
    }

    /**
     * Inicia o mascaramento, vinculando o evento ao input.
     */
    init() {
        this.#inputElement.addEventListener('input', this.#boundApplyMask);
        // Aplica a máscara inicial caso o input já tenha um valor (ex: preenchido pelo navegador).
        this.#applyMask({ target: this.#inputElement });
    }

    /**
     * Para o mascaramento, desvinculando o evento para limpar recursos.
     */
    destroy() {
        this.#inputElement.removeEventListener('input', this.#boundApplyMask);
    }

    /**
     * O núcleo da lógica de mascaramento. É executado a cada evento 'input'.
     * @param {Event} event - O objeto do evento DOM.
     * @private
     */
    #applyMask(event) {
        const input = event.target;
        
        // 1. Extrai apenas os caracteres digitados pelo usuário, removendo literais da máscara.
        let rawValue = this.#getRawValue(input.value);
        let maskedValue = '';
        let rawIndex = 0;
        let maskIndex = 0;
        
        // 2. Itera sobre o padrão da máscara e o valor bruto simultaneamente.
        while (maskIndex < this.#maskPattern.length && rawIndex < rawValue.length) {
            const maskChar = this.#maskPattern[maskIndex];
            
            if (maskChar === this.#placeholderChar) {
                // Se o caractere da máscara for um placeholder, consome um caractere do valor bruto.
                maskedValue += rawValue[rawIndex];
                rawIndex++;
                maskIndex++;
            } else {
                // Se for um literal (ex: '.', '/', '-'), adiciona-o à saída.
                maskedValue += maskChar;
                maskIndex++;
            }
        }

        // 3. Atualiza o valor do input.
        input.value = maskedValue;

        // 4. Gerencia a posição do cursor para uma UX fluida.
        // A lógica é colocar o cursor após o último caractere inserido.
        // `requestAnimationFrame` garante que o cursor seja posicionado após o navegador renderizar a mudança de valor.
        requestAnimationFrame(() => {
            input.setSelectionRange(maskedValue.length, maskedValue.length);
        });
    }

    /**
     * Extrai o valor bruto do input, removendo os caracteres literais da máscara.
     * @param {string} inputValue - O valor atual do campo de input.
     * @returns {string} - O valor contendo apenas os dados inseridos pelo usuário.
     * @private
     */
    #getRawValue(inputValue) {
        let rawValue = '';
        const patternChars = new Set(this.#maskPattern.split(''));
        patternChars.delete(this.#placeholderChar); // O placeholder não é um literal.

        for (const char of inputValue) {
            if (!patternChars.has(char)) {
                rawValue += char;
            }
        }
        return rawValue;
    }
}