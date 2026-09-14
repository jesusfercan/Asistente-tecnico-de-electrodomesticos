/**
 * Asistente Técnico de Electrodomésticos - Vanilla JS Engine
 * Conectado a Google Gemini (gemini-3.6-flash)
 */

// Global Constants
const GEMINI_MODEL = "gemini-3.6-flash";
const API_KEY_STORAGE_KEY = "gemini_api_key";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// System Instructions for Technical Assistant
const SYSTEM_INSTRUCTION = `Eres un especialista profesional en diagnóstico y reparación de electrodomésticos.
Tu objetivo es ayudar a identificar averías de forma estructurada, segura y práctica.
No debes afirmar con certeza que un componente está averiado sin pruebas suficientes.
Debes comenzar siempre por las comprobaciones sencillas y seguras.
Cuando una prueba implique riesgo eléctrico, alta tensión, condensadores, microondas, refrigerantes, gas, calor extremo o desmontaje complejo, advertir claramente al usuario y recomendar intervención profesional cuando corresponda.
Explica cada procedimiento paso a paso.
Cuando exista incertidumbre, dilo claramente.
No inventes datos técnicos específicos del fabricante.
Si necesitas información adicional para continuar el diagnóstico, pregunta al usuario de forma concreta.

Prioriza siempre:
1. Seguridad.
2. Diagnóstico.
3. Comprobaciones.
4. Solución.
5. Prevención.`;

// Application State
let conversationHistory = [];
let currentApplianceDetails = null;
let lastFailedAction = null;
let retryCount = 0;
const MAX_AUTO_RETRIES = 2;

// DOM Elements Cache
const elements = {
    // Config Modal
    btnOpenConfig: document.getElementById('btn-open-config'),
    configModal: document.getElementById('config-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelConfig: document.getElementById('btn-cancel-config'),
    btnSaveKey: document.getElementById('btn-save-key'),
    btnRemoveKey: document.getElementById('btn-remove-key'),
    apiKeyInput: document.getElementById('api-key-input'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    apiKeyStatusMsg: document.getElementById('api-key-status-msg'),

    // Status Bar
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    btnNewDiagnosis: document.getElementById('btn-new-diagnosis'),
    newDiagnosisContainer: document.getElementById('new-diagnosis-container'),

    // Error Panel
    errorPanel: document.getElementById('error-panel'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    btnCloseError: document.getElementById('btn-close-error'),
    btnRetry: document.getElementById('btn-retry'),
    btnToggleTechDetails: document.getElementById('btn-toggle-tech-details'),
    techDetailsContainer: document.getElementById('tech-details-container'),
    techDetailsContent: document.getElementById('tech-details-content'),
    btnCopyTechDetails: document.getElementById('btn-copy-tech-details'),

    // Form
    formSection: document.getElementById('form-section'),
    diagnosisForm: document.getElementById('diagnosis-form'),
    applianceType: document.getElementById('appliance-type'),
    brand: document.getElementById('brand'),
    model: document.getElementById('model'),
    errorCode: document.getElementById('error-code'),
    description: document.getElementById('description'),
    charCount: document.getElementById('char-count'),
    btnSubmitDiagnosis: document.getElementById('btn-submit-diagnosis'),

    // Errors Form
    errApplianceType: document.getElementById('err-appliance-type'),
    errDescription: document.getElementById('err-description'),

    // Chat
    chatSection: document.getElementById('chat-section'),
    chatMessages: document.getElementById('chat-messages'),
    chatApplianceInfo: document.getElementById('chat-appliance-info'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    btnSendChat: document.getElementById('btn-send-chat'),
    btnExportChat: document.getElementById('btn-export-chat'),

    // Loading
    loadingIndicator: document.getElementById('loading-indicator'),
    loadingText: document.getElementById('loading-text')
};

// Initialization & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    checkApiKeyStatus();
}

function setupEventListeners() {
    elements.btnOpenConfig.addEventListener('click', openConfigModal);
    elements.btnCloseModal.addEventListener('click', closeConfigModal);
    elements.btnCancelConfig.addEventListener('click', closeConfigModal);
    elements.btnSaveKey.addEventListener('click', handleSaveApiKey);
    elements.btnRemoveKey.addEventListener('click', handleRemoveApiKey);
    elements.btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);

    elements.description.addEventListener('input', () => {
        elements.charCount.textContent = elements.description.value.length;
        if (elements.description.value.trim()) {
            elements.errDescription.textContent = '';
        }
    });

    elements.applianceType.addEventListener('change', () => {
        if (elements.applianceType.value) {
            elements.errApplianceType.textContent = '';
        }
    });

    elements.diagnosisForm.addEventListener('submit', handleDiagnosisSubmit);
    elements.chatForm.addEventListener('submit', handleChatSubmit);

    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            elements.chatForm.requestSubmit();
        }
    });

    elements.btnCloseError.addEventListener('click', clearError);
    elements.btnToggleTechDetails.addEventListener('click', () => {
        elements.techDetailsContainer.classList.toggle('hidden');
    });
    elements.btnCopyTechDetails.addEventListener('click', copyTechDetails);
    elements.btnRetry.addEventListener('click', () => {
        if (lastFailedAction) {
            clearError();
            lastFailedAction();
        }
    });

    elements.btnNewDiagnosis.addEventListener('click', confirmNewDiagnosis);
    elements.btnExportChat.addEventListener('click', exportConversation);
}

// API Key Managers
function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    checkApiKeyStatus();
}

function removeApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    checkApiKeyStatus();
}

function checkApiKeyStatus() {
    const key = getApiKey();
    if (key) {
        showStatus('connected', 'Gemini conectado');
        elements.apiKeyInput.value = key;
        elements.apiKeyStatusMsg.textContent = '✓ API Key configurada correctamente.';
        elements.apiKeyStatusMsg.style.color = 'var(--success-color)';
    } else {
        showStatus('no-key', 'API Key no configurada');
        elements.apiKeyInput.value = '';
        elements.apiKeyStatusMsg.textContent = '⚠️ Sin API Key. Configura una para usar el asistente.';
        elements.apiKeyStatusMsg.style.color = 'var(--warning-color)';
    }
}

function openConfigModal() {
    elements.configModal.classList.remove('hidden');
    elements.apiKeyInput.focus();
}

function closeConfigModal() {
    elements.configModal.classList.add('hidden');
}

function toggleKeyVisibility() {
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
}

function handleSaveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (!key) {
        alert('Por favor, introduce una API Key válida.');
        return;
    }
    saveApiKey(key);
    closeConfigModal();
    clearError();
}

function handleRemoveApiKey() {
    if (confirm('¿Estás seguro de que deseas eliminar tu API Key guardada?')) {
        removeApiKey();
        closeConfigModal();
    }
}

// Status and Errors
function showStatus(state, message) {
    elements.statusText.textContent = message;
    elements.statusDot.className = 'status-dot';
    
    switch (state) {
        case 'connected':
            elements.statusDot.classList.add('dot-green');
            break;
        case 'connecting':
            elements.statusDot.classList.add('dot-yellow');
            break;
        case 'error':
            elements.statusDot.classList.add('dot-red');
            break;
        case 'no-key':
        default:
            elements.statusDot.classList.add('dot-gray');
            break;
    }
}

function showError(userFriendlyMessage, technicalDetails = null, canRetry = false) {
    showStatus('error', 'Error en el asistente');
    elements.errorTitle.textContent = 'Ha ocurrido un error';
    elements.errorMessage.textContent = userFriendlyMessage;
    
    if (technicalDetails) {
        const detailsObj = {
            timestamp: new Date().toISOString(),
            model: GEMINI_MODEL,
            ...technicalDetails
        };
        elements.techDetailsContent.textContent = JSON.stringify(detailsObj, null, 2);
        elements.btnToggleTechDetails.classList.remove('hidden');
    } else {
        elements.btnToggleTechDetails.classList.add('hidden');
        elements.techDetailsContainer.classList.add('hidden');
    }

    if (canRetry && lastFailedAction) {
        elements.btnRetry.classList.remove('hidden');
    } else {
        elements.btnRetry.classList.add('hidden');
    }

    elements.errorPanel.classList.remove('hidden');
    elements.errorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearError() {
    elements.errorPanel.classList.add('hidden');
    elements.techDetailsContainer.classList.add('hidden');
    checkApiKeyStatus();
}

function copyTechDetails() {
    const text = elements.techDetailsContent.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = elements.btnCopyTechDetails.textContent;
        elements.btnCopyTechDetails.textContent = '✓ Copiado';
        setTimeout(() => {
            elements.btnCopyTechDetails.textContent = originalText;
        }, 2000);
    });
}

// Form Validation and Prompt
function validateForm() {
    let isValid = true;
    elements.errApplianceType.textContent = '';
    elements.errDescription.textContent = '';

    const apiKey = getApiKey();
    if (!apiKey) {
        showError(
            "Para utilizar el asistente necesitas configurar una API Key de Gemini. Pulsa en 'Configuración' para guardar una.",
            { reason: "Missing API Key" }
        );
        openConfigModal();
        return false;
    }

    if (!elements.applianceType.value) {
        elements.errApplianceType.textContent = 'Selecciona un tipo de electrodoméstico.';
        isValid = false;
    }

    if (!elements.description.value.trim()) {
        elements.errDescription.textContent = 'La descripción del problema es obligatoria.';
        isValid = false;
    }

    return isValid;
}

function buildInitialPrompt(data) {
    return `Eres un técnico especialista en reparación y diagnóstico de electrodomésticos.

Tu función es ayudar al usuario a identificar la causa probable de una avería y proporcionar un procedimiento de diagnóstico y solución seguro, ordenado y práctico.

DATOS DEL ELECTRODOMÉSTICO

Tipo:
${data.type}

Marca:
${data.brand || 'No especificada'}

Modelo:
${data.model || 'No especificado'}

Código de error:
${data.errorCode || 'Ninguno'}

DESCRIPCIÓN DEL PROBLEMA:
${data.description}

INSTRUCCIONES PARA EL DIAGNÓSTICO

Analiza cuidadosamente la información proporcionada.

Debes:

1. Identificar las causas más probables del problema.
2. Diferenciar entre causas fáciles de comprobar y causas que requieren conocimientos técnicos.
3. Proponer un diagnóstico paso a paso, empezando siempre por las comprobaciones más sencillas, seguras y económicas.
4. Indicar exactamente qué debe revisar el usuario.
5. Explicar qué resultado debería obtener en cada comprobación.
6. Explicar qué significa cada posible resultado.
7. Proponer la solución correspondiente.
8. Si puede existir más de una causa, ordenarlas por probabilidad.
9. Si existe un código de error, explicar qué significa y qué componentes podrían estar relacionados.
10. Si el modelo concreto es importante, indicar qué información adicional sería necesaria.
11. No inventar especificaciones concretas del fabricante si no se dispone de información suficiente.
12. Diferenciar claramente entre información confirmada, hipótesis y comprobaciones recomendadas.
13. Si el usuario puede realizar una comprobación sencilla sin herramientas especiales, explicarla detalladamente.
14. Si es necesaria una medición eléctrica, electrónica, desmontaje o intervención técnica, indicarlo claramente.
15. Indicar las herramientas necesarias cuando sean relevantes.
16. Estimar la dificultad de cada reparación.
17. Indicar si una reparación debería realizarla un técnico profesional.

FORMATO DE RESPUESTA

La respuesta debe estar organizada con estos apartados:

## Diagnóstico inicial

Explica brevemente qué podría estar ocurriendo.

## Causas más probables

Lista las posibles causas ordenadas de mayor a menor probabilidad.

## Comprobaciones paso a paso

Para cada comprobación indicar:

- Qué revisar.
- Cómo revisarlo.
- Qué resultado esperar.
- Qué significa si el resultado es correcto.
- Qué significa si el resultado es incorrecto.

## Solución recomendada

Explicar la reparación o solución más probable.

## Herramientas necesarias

Enumerar las herramientas necesarias.

## Dificultad

Indicar:

Fácil / Media / Alta / Profesional

y explicar brevemente por qué.

## Seguridad

Indicar las precauciones necesarias.

IMPORTANTE SOBRE SEGURIDAD:

Nunca recomendar manipular circuitos eléctricos energizados.

Antes de desmontar un electrodoméstico conectado a la red eléctrica, indicar que debe desconectarse de la alimentación.

En electrodomésticos con componentes de alta tensión, condensadores, microondas, sistemas frigoríficos, gas o cualquier otro elemento potencialmente peligroso, advertir que la intervención debe realizarla un técnico cualificado cuando corresponda.

No proporcionar instrucciones que puedan provocar una descarga eléctrica, incendio, fuga de refrigerante, exposición a radiación de microondas u otro riesgo.

Si no hay información suficiente para realizar un diagnóstico fiable, debes decirlo explícitamente y solicitar al usuario los datos que falten.

No afirmes que una pieza está averiada sin suficiente evidencia.

Prioriza siempre un diagnóstico progresivo y basado en comprobaciones.`;
}

// Gemini API Fetch Engine
async function callGemini(contents) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw { userMsg: "API Key no configurada.", details: { code: 401 } };
    }

    const endpoint = `${GEMINI_API_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        }
    };

    let response;
    let data;

    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

    } catch (netErr) {
        throw {
            userMsg: "Error de conexión de red o problema de CORS. Comprueba tu conexión a Internet o los permisos del navegador.",
            details: { type: "Network/CORS Error", originalError: netErr.message, endpoint: GEMINI_API_BASE_URL },
            canRetry: true
        };
    }

    try {
        data = await response.json();
    } catch (parseErr) {
        throw {
            userMsg: "La respuesta recibida del servidor de Gemini no es un JSON válido.",
            details: { httpStatus: response.status, parseError: parseErr.message },
            canRetry: true
        };
    }

    if (!response.ok) {
        const errorDetails = {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            apiError: data.error || data
        };

        let userMsg = "Error al comunicarse con el servicio de IA.";

        switch (response.status) {
            case 400:
                userMsg = "Petición incorrecta (HTTP 400). Comprueba que la entrada no sea demasiado larga o contenga caracteres no válidos.";
                break;
            case 401:
            case 403:
                userMsg = "La API Key no es válida o no tiene permisos para utilizar el modelo " + GEMINI_MODEL + ". Revisa tu API Key en Configuración.";
                break;
            case 404:
                userMsg = `El modelo especificado (${GEMINI_MODEL}) no fue encontrado o no está disponible en la API actual.`;
                break;
            case 429:
                userMsg = "Se ha alcanzado el límite de cuota o de peticiones de la API Key. Por favor, espera un instante antes de reintentar.";
                break;
            case 500:
            case 502:
            case 503:
                userMsg = "El servicio de Google Gemini está experimentando problemas temporales (HTTP " + response.status + "). Inténtalo de nuevo en unos momentos.";
                break;
        }

        const isTemporary = [429, 500, 502, 503].includes(response.status);
        throw { userMsg, details: errorDetails, canRetry: isTemporary };
    }

    try {
        const candidate = data.candidates && data.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
            throw new Error("Estructura de candidatos vacía en la respuesta");
        }
        return candidate.content.parts[0].text;
    } catch (extractErr) {
        throw {
            userMsg: "No se pudo extraer el texto de diagnóstico de la respuesta devuelta por Gemini.",
            details: { rawResponse: data, extractError: extractErr.message }
        };
    }
}

function buildApiContentsPayload() {
    return conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
}

// Handlers
async function handleDiagnosisSubmit(e) {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    currentApplianceDetails = {
        type: elements.applianceType.value,
        brand: elements.brand.value.trim(),
        model: elements.model.value.trim(),
        errorCode: elements.errorCode.value.trim(),
        description: elements.description.value.trim(),
        date: new Date().toLocaleString()
    };

    const initialPrompt = buildInitialPrompt(currentApplianceDetails);

    conversationHistory = [
        { role: 'user', content: initialPrompt }
    ];

    lastFailedAction = () => executeDiagnosisRequest();
    retryCount = 0;

    await executeDiagnosisRequest();
}

async function executeDiagnosisRequest() {
    setLoading(true, "Analizando el problema con la IA de Gemini...");
    showStatus('connecting', 'Conectando con Gemini...');

    try {
        const payload = buildApiContentsPayload();
        const responseText = await callGemini(payload);

        conversationHistory.push({ role: 'assistant', content: responseText });

        elements.formSection.classList.add('hidden');
        elements.chatSection.classList.remove('hidden');
        elements.newDiagnosisContainer.classList.remove('hidden');

        const info = `${currentApplianceDetails.type} ${currentApplianceDetails.brand ? '· ' + currentApplianceDetails.brand : ''} ${currentApplianceDetails.errorCode ? '· Error: ' + currentApplianceDetails.errorCode : ''}`;
        elements.chatApplianceInfo.textContent = info;

        renderChatHistory();
        showStatus('connected', 'Gemini conectado');
        retryCount = 0;

    } catch (err) {
        handleApiCallError(err, () => executeDiagnosisRequest());
    } finally {
        setLoading(false);
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    clearError();

    const text = elements.chatInput.value.trim();
    if (!text) return;

    conversationHistory.push({ role: 'user', content: text });
    elements.chatInput.value = '';

    renderChatHistory();
    scrollChatToBottom();

    lastFailedAction = () => executeChatMessageRequest();
    retryCount = 0;

    await executeChatMessageRequest();
}

async function executeChatMessageRequest() {
    setLoading(true, "Gemini está procesando tu respuesta...");
    showStatus('connecting', 'Conectando con Gemini...');

    try {
        const payload = buildApiContentsPayload();
        const responseText = await callGemini(payload);

        conversationHistory.push({ role: 'assistant', content: responseText });
        renderChatHistory();
        scrollChatToBottom();
        showStatus('connected', 'Gemini conectado');
        retryCount = 0;

    } catch (err) {
        handleApiCallError(err, () => executeChatMessageRequest());
    } finally {
        setLoading(false);
    }
}

function handleApiCallError(err, retryCallback) {
    const userMsg = err.userMsg || "Ocurrió un error inesperado al procesar la solicitud.";
    const details = err.details || null;
    const canRetry = !!err.canRetry;

    if (canRetry && retryCount < MAX_AUTO_RETRIES) {
        retryCount++;
        showStatus('connecting', `Reintentando conexión (${retryCount}/${MAX_AUTO_RETRIES})...`);
        setTimeout(() => {
            retryCallback();
        }, 2000 * retryCount);
        return;
    }

    showError(userMsg, details, canRetry);
}

// Markdown Sanitization & Renderer
function renderChatHistory() {
    elements.chatMessages.innerHTML = '';

    conversationHistory.forEach((msg, index) => {
        if (index === 0 && msg.role === 'user') {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'message-bubble user';
            summaryDiv.innerHTML = `
                <div class="message-header">
                    <span><strong>Tú</strong> (Consulta Inicial)</span>
                    <span>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="message-content">
                    <p><strong>Diagnóstico solicitado para:</strong> ${escapeHTML(currentApplianceDetails.type)} ${escapeHTML(currentApplianceDetails.brand)}</p>
                    <p><em>"${escapeHTML(currentApplianceDetails.description)}"</em></p>
                </div>
            `;
            elements.chatMessages.appendChild(summaryDiv);
            return;
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';

        const senderSpan = document.createElement('span');
        senderSpan.innerHTML = `<strong>${msg.role === 'user' ? 'Tú' : 'Asistente IA'}</strong>`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy';
        copyBtn.textContent = 'Copiar';
        copyBtn.addEventListener('click', () => copyMessageText(msg.content, copyBtn));

        actionsDiv.appendChild(copyBtn);
        headerDiv.appendChild(senderSpan);
        headerDiv.appendChild(actionsDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (msg.role === 'user') {
            contentDiv.textContent = msg.content;
        } else {
            contentDiv.innerHTML = safeMarkdownToHTML(msg.content);
        }

        msgDiv.appendChild(headerDiv);
        msgDiv.appendChild(contentDiv);
        elements.chatMessages.appendChild(msgDiv);
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safeMarkdownToHTML(markdown) {
    if (!markdown) return '';

    let safe = escapeHTML(markdown);

    safe = safe.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    safe = safe.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    safe = safe.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');

    safe = safe.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    safe = safe.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    safe = safe.replace(/<\/ul>\s*<ul>/g, '');

    const lines = safe.split('\n');
    let formatted = lines.map(line => {
        line = line.trim();
        if (!line) return '';
        if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<li') || line.startsWith('<pre')) {
            return line;
        }
        return `<p>${line}</p>`;
    }).join('');

    return formatted;
}

// Helpers
function setLoading(isLoading, text = "Procesando...") {
    if (isLoading) {
        elements.loadingText.textContent = text;
        elements.loadingIndicator.classList.remove('hidden');
        elements.btnSubmitDiagnosis.disabled = true;
        elements.btnSendChat.disabled = true;
        elements.chatInput.disabled = true;
    } else {
        elements.loadingIndicator.classList.add('hidden');
        elements.btnSubmitDiagnosis.disabled = false;
        elements.btnSendChat.disabled = false;
        elements.chatInput.disabled = false;
    }
}

function scrollChatToBottom() {
    setTimeout(() => {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }, 50);
}

function copyMessageText(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btnElement.textContent;
        btnElement.textContent = '✓ Copiado';
        setTimeout(() => {
            btnElement.textContent = original;
        }, 2000);
    });
}

function confirmNewDiagnosis() {
    if (conversationHistory.length > 0) {
        if (!confirm('¿Deseas iniciar un nuevo diagnóstico? Se borrará la conversación actual.')) {
            return;
        }
    }
    resetToInitialForm();
}

function resetToInitialForm() {
    conversationHistory = [];
    currentApplianceDetails = null;
    elements.diagnosisForm.reset();
    elements.charCount.textContent = '0';

    elements.chatSection.classList.add('hidden');
    elements.formSection.classList.remove('hidden');
    elements.newDiagnosisContainer.classList.add('hidden');
    clearError();
}

function exportConversation() {
    if (!conversationHistory.length || !currentApplianceDetails) {
        alert("No hay diagnóstico activo para exportar.");
        return;
    }

    let exportText = `========================================================\n`;
    exportText += ` INFORME DE DIAGNÓSTICO TÉCNICO DE ELECTRODOMÉSTICOS\n`;
    exportText += `========================================================\n`;
    exportText += `Fecha: ${currentApplianceDetails.date}\n`;
    exportText += `Electrodoméstico: ${currentApplianceDetails.type}\n`;
    exportText += `Marca: ${currentApplianceDetails.brand || 'No especificada'}\n`;
    exportText += `Modelo: ${currentApplianceDetails.model || 'No especificado'}\n`;
    exportText += `Código de error: ${currentApplianceDetails.errorCode || 'Ninguno'}\n`;
    exportText += `--------------------------------------------------------\n`;
    exportText += `DESCRIPCIÓN DEL PROBLEMA:\n${currentApplianceDetails.description}\n`;
    exportText += `========================================================\n\n`;
    exportText += `HISTORIAL DE LA CONSULTA:\n\n`;

    conversationHistory.forEach((msg, idx) => {
        if (idx === 0) return;
        const roleName = msg.role === 'user' ? 'USUARIO' : 'ASISTENTE TÉCNICO IA';
        exportText += `[${roleName}]\n${msg.content}\n\n--------------------------------------------------------\n\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = `diagnostico_${currentApplianceDetails.type.toLowerCase()}_${Date.now()}.txt`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}