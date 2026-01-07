
import Cropper from 'cropperjs';
import confetti from 'canvas-confetti';

// Wir nutzen hier keine direkte GoogleGenAI Instanz mehr im Frontend, 
// sondern rufen unsere Netlify Functions auf. Das ist sicherer.

export interface Recipe {
  id?: string;
  recipeName: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  chefTip?: string;
  servings?: number;
  rating?: number; // Added for compatibility with tests
}

// --- DOM References ---
// Exporting references as expected by tests
export const recipeForm = document.getElementById('recipe-form') as HTMLFormElement;
export const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
export const servingsInput = document.getElementById('servings-input') as HTMLInputElement;
export const difficultySelect = document.getElementById('difficulty-select') as HTMLSelectElement;
export const wishesInput = document.getElementById('wishes-input') as HTMLInputElement;

export const fridgeModal = document.getElementById('fridge-modal') as HTMLDivElement;
export const manualRecipeModal = document.getElementById('manual-recipe-modal') as HTMLDivElement;
export const cropperModal = document.getElementById('cropper-modal') as HTMLDivElement;
export const recipeOutput = document.getElementById('recipe-output') as HTMLDivElement;
export const recipeActionsContainer = document.getElementById('recipe-actions-container') as HTMLDivElement;
export const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
export const savedRecipesList = document.getElementById('saved-recipes-list') as HTMLDivElement;
export const shoppingListContent = document.getElementById('shopping-list-content') as HTMLDivElement;
export const fridgeInventory = document.getElementById('fridge-inventory') as HTMLTextAreaElement;

// Missing DOM elements required by index.test.ts
export const draftNotification = document.getElementById('draft-notification') as HTMLDivElement;
export const restoreDraftBtn = document.getElementById('restore-draft-btn') as HTMLButtonElement;
export const dismissDraftBtn = document.getElementById('dismiss-draft-btn') as HTMLButtonElement;
export const savedCountBadge = document.getElementById('saved-count-badge') as HTMLSpanElement;
export const loadingIndicatorSpan = document.querySelector('#loading-indicator span') as HTMLSpanElement;
export const savedRecipesSearchInput = document.getElementById('saved-recipes-search') as HTMLInputElement;

let cropper: Cropper | null = null;

// --- API Wrapper for Netlify Functions ---

async function callRecipeAPI(payload: any) {
    showLoading(true);
    try {
        const response = await fetch('/.netlify/functions/recipe', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("API Fehler");
        return await response.json();
    } catch (e) {
        alert("Küchenfehler: Der Server antwortet nicht.");
        return null;
    } finally {
        showLoading(false);
    }
}

// --- Logic & Storage Functions ---

// Scale quantities in an ingredient line string
export function scaleIngredientLine(line: string, oldServings: number, newServings: number): string {
    if (!oldServings || !newServings || oldServings === newServings) return line;
    const ratio = newServings / oldServings;
    
    return line.replace(/(\d+([.,]\d+)?)/g, (match) => {
        const num = parseFloat(match.replace(',', '.'));
        if (isNaN(num)) return match;
        const scaled = num * ratio;
        const hasComma = match.includes(',');
        // Format back: limit decimals and remove trailing zeros
        let formatted = scaled.toFixed(2).replace(/\.?0+$/, '');
        if (hasComma) {
            formatted = formatted.replace('.', ',');
        }
        return formatted;
    });
}

// Update all ingredient quantities for a recipe based on new servings
export function updateIngredientQuantities(recipe: Recipe, newServings: number): string[] {
    if (!recipe.servings) return recipe.ingredients;
    return recipe.ingredients.map(line => scaleIngredientLine(line, recipe.servings!, newServings));
}

export function getSavedRecipes(): Recipe[] {
    const saved = localStorage.getItem('savedRecipes');
    return saved ? JSON.parse(saved) : [];
}

export function saveRecipeToStorage(recipe: Recipe): boolean {
    const saved = getSavedRecipes();
    if (saved.some(r => r.recipeName.toLowerCase() === recipe.recipeName.toLowerCase())) {
        alert('Ein Rezept mit diesem Namen existiert bereits.');
        return false;
    }
    saved.push(recipe);
    localStorage.setItem('savedRecipes', JSON.stringify(saved));
    updateSavedCount();
    return true;
}

export function updateRecipeInStorage(name: string, updatedRecipe: Recipe) {
    const saved = getSavedRecipes();
    const index = saved.findIndex(r => r.recipeName.toLowerCase() === name.toLowerCase());
    if (index !== -1) {
        saved[index] = updatedRecipe;
        localStorage.setItem('savedRecipes', JSON.stringify(saved));
        updateSavedCount();
        renderSaved();
    }
}

export function removeRecipeFromStorage(name: string) {
    const saved = getSavedRecipes();
    const filtered = saved.filter(r => r.recipeName.toLowerCase() !== name.toLowerCase());
    if (filtered.length !== saved.length) {
        localStorage.setItem('savedRecipes', JSON.stringify(filtered));
        updateSavedCount();
        renderSaved();
    }
}

export function isRecipeSaved(name: string): boolean {
    return getSavedRecipes().some(r => r.recipeName.toLowerCase() === name.toLowerCase());
}

export function updateSavedCount() {
    if (!savedCountBadge) return;
    const count = getSavedRecipes().length;
    savedCountBadge.textContent = count > 0 ? count.toString() : '';
    savedCountBadge.classList.toggle('hidden', count === 0);
}

// --- Draft Handling ---

export function saveDraft() {
    if (promptInput && promptInput.value.trim()) {
        const draft = {
            prompt: promptInput.value,
            difficulty: difficultySelect.value,
            wishes: wishesInput.value,
            servings: parseInt(servingsInput.value) || 2
        };
        localStorage.setItem('recipeDraft', JSON.stringify(draft));
    } else {
        localStorage.removeItem('recipeDraft');
    }
}

export function clearDraft() {
    localStorage.removeItem('recipeDraft');
}

export function checkForDraft() {
    const draftStr = localStorage.getItem('recipeDraft');
    if (draftStr && draftNotification) {
        const draft = JSON.parse(draftStr);
        draftNotification.classList.remove('hidden');
        
        restoreDraftBtn.addEventListener('click', () => {
            promptInput.value = draft.prompt;
            difficultySelect.value = draft.difficulty;
            wishesInput.value = draft.wishes;
            servingsInput.value = draft.servings.toString();
            draftNotification.classList.add('hidden');
        });
        
        dismissDraftBtn.addEventListener('click', () => {
            clearDraft();
            draftNotification.classList.add('hidden');
        });
    }
}

// --- UI Logic ---

function switchTab(tabId: string) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
    
    if (tabId === 'tab-book') renderSaved();
    if (tabId === 'tab-shopping') renderShopping();
}

function renderRecipe(recipe: Recipe) {
    recipeOutput.innerHTML = `
        <div class="recipe-card glass-card">
            <h2>${recipe.recipeName}</h2>
            <p><i>${recipe.description}</i></p>
            <h4>Zutaten</h4>
            <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
            <h4>Schritte</h4>
            <div>${recipe.instructions.map((step, idx) => `<p><b>${idx+1}.</b> ${step}</p>`).join('')}</div>
        </div>
    `;
    recipeActionsContainer.innerHTML = `
        <button id="save-recipe-btn" class="primary-btn">Im Buch speichern</button>
    `;
    recipeActionsContainer.classList.remove('hidden');
    document.getElementById('save-recipe-btn')!.onclick = () => saveRecipe(recipe);
}

function saveRecipe(recipe: Recipe) {
    if (saveRecipeToStorage(recipe)) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
        alert("Gespeichert!");
    }
}

export function renderSaved() {
    const saved = getSavedRecipes();
    savedRecipesList.innerHTML = saved.length ? '' : '<p>Dein Kochbuch ist leer.</p>';
    saved.forEach((r: Recipe) => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.innerHTML = `<h3>${r.recipeName}</h3><p>${r.description}</p>`;
        div.onclick = () => renderRecipe(r);
        savedRecipesList.appendChild(div);
    });
}

// Alias for tests
export { renderSaved as renderSavedRecipes };

function renderShopping() {
    // Einfache Liste
    shoppingListContent.innerHTML = '<p>Einkaufsliste folgt in Kürze...</p>';
}

function showLoading(show: boolean) {
    loadingIndicator.classList.toggle('hidden', !show);
}

// --- Init ---

function init() {
    // Tab Navigation
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        (btn as HTMLElement).onclick = () => switchTab(btn.getAttribute('data-tab')!);
    });

    // Generator
    if (recipeForm) {
        recipeForm.onsubmit = async (e) => {
            e.preventDefault();
            const res = await callRecipeAPI({
                type: 'generate',
                prompt: promptInput.value,
                difficulty: difficultySelect.value,
                servings: servingsInput.value,
                wishes: wishesInput.value
            });
            if (res) renderRecipe(res);
        };
    }

    // Auto-save draft on input change
    [promptInput, difficultySelect, wishesInput, servingsInput].forEach(el => {
        if (el) el.oninput = () => saveDraft();
    });

    // Scanner
    const fridgeModeBtn = document.getElementById('fridge-mode-btn');
    if (fridgeModeBtn) fridgeModeBtn.onclick = () => fridgeModal.classList.remove('hidden');
    
    const magicProcessBtn = document.getElementById('magic-process-btn');
    if (magicProcessBtn) {
        magicProcessBtn.onclick = async () => {
            const res = await callRecipeAPI({
                type: 'generate',
                prompt: `Aus meinem Kühlschrank: ${fridgeInventory.value}`,
                difficulty: 'leicht'
            });
            if (res) {
                renderRecipe(res);
                fridgeModal.classList.add('hidden');
            }
        };
    }

    // Modals schließen
    document.querySelectorAll('.close-btn').forEach(btn => {
        (btn as HTMLElement).onclick = () => (btn.closest('.modal-overlay') as HTMLElement).classList.add('hidden');
    });

    const manualEntryNavBtn = document.getElementById('manual-entry-nav-btn');
    if (manualEntryNavBtn) manualEntryNavBtn.onclick = () => manualRecipeModal.classList.remove('hidden');

    // Initial page checks
    checkForDraft();
    updateSavedCount();
}

init();
