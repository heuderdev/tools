// js/validators.js

/**
 * Função utilitária para validar CPF.
 * @param {string} cpf O número do CPF a ser validado.
 * @returns {boolean} True se o CPF for válido, false caso contrário.
 */
export const isCpfValid = (cpf) => {
    if (!cpf) return false;

    cpf = cpf.replace(/[^\d]+/g, ''); // Remove caracteres não numéricos

    if (cpf.length !== 11) return false;

    // Elimina CPFs inválidos conhecidos (sequências de dígitos iguais)
    if (
        cpf === "00000000000" || cpf === "11111111111" || cpf === "22222222222" ||
        cpf === "33333333333" || cpf === "44444444444" || cpf === "55555555555" ||
        cpf === "66666666666" || cpf === "77777777777" || cpf === "88888888888" ||
        cpf === "99999999999"
    ) {
        return false;
    }

    // Valida 1º dígito verificador
    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;

    if ((remainder === 10) || (remainder === 11)) {
        remainder = 0;
    }
    if (remainder !== parseInt(cpf.substring(9, 10))) {
        return false;
    }

    // Valida 2º dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;

    if ((remainder === 10) || (remainder === 11)) {
        remainder = 0;
    }
    if (remainder !== parseInt(cpf.substring(10, 11))) {
        return false;
    }

    return true;
};
