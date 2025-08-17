// Email Snippets Content Script
console.log('Email Snippets: Content script loaded');

let snippets = [];

// Load snippets from storage
function loadSnippets() {
    chrome.storage.sync.get(['snippets'], function(result) {
        snippets = result.snippets || [];
        console.log('Email Snippets: Loaded', snippets.length, 'snippets');
    });
}

// Initial load
loadSnippets();

// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && changes.snippets) {
        snippets = changes.snippets.newValue || [];
        console.log('Email Snippets: Updated snippets:', snippets.length);
    }
});

// Check if element can accept text input
function isTextInput(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const type = (element.type || '').toLowerCase();
    
    return (
        tagName === 'textarea' ||
        (tagName === 'input' && ['text', 'email', 'search', ''].includes(type)) ||
        element.contentEditable === 'true' ||
        element.isContentEditable
    );
}

// Get text value from element
function getElementValue(element) {
    if (element.value !== undefined) {
        return element.value;
    } else if (element.textContent !== undefined) {
        return element.textContent;
    } else if (element.innerText !== undefined) {
        return element.innerText;
    }
    return '';
}

// Replace shortcut with snippet text
function replaceShortcut(element, shortcut, replacement) {
    console.log('Email Snippets: Replacing', shortcut, 'with snippet');
    
    if (element.value !== undefined) {
        // Handle regular input/textarea elements
        const value = element.value;
        const cursorPos = element.selectionStart || value.length;
        
        // Find the most recent occurrence of the shortcut before cursor
        const beforeCursor = value.substring(0, cursorPos);
        const shortcutIndex = beforeCursor.lastIndexOf(shortcut);
        
        if (shortcutIndex !== -1) {
            const newValue = value.substring(0, shortcutIndex) + 
                           replacement + 
                           value.substring(shortcutIndex + shortcut.length);
            
            element.value = newValue;
            
            // Set cursor position after replacement
            const newCursorPos = shortcutIndex + replacement.length;
            element.setSelectionRange(newCursorPos, newCursorPos);
            
            // Trigger events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log('Email Snippets: Successfully replaced in input element');
            return true;
        }
    } else if (element.contentEditable === 'true' || element.isContentEditable) {
        // Handle contenteditable elements
        try {
            const text = element.textContent || element.innerText || '';
            const shortcutIndex = text.lastIndexOf(shortcut);
            
            if (shortcutIndex !== -1) {
                // Simple replacement for contenteditable
                const selection = window.getSelection();
                const range = document.createRange();
                
                // Create a text node walker to find the exact position
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let currentPos = 0;
                let textNode = null;
                let nodeOffset = 0;
                
                // Find the text node containing the shortcut
                while (textNode = walker.nextNode()) {
                    const nodeText = textNode.textContent;
                    const nodeEnd = currentPos + nodeText.length;
                    
                    if (shortcutIndex >= currentPos && shortcutIndex < nodeEnd) {
                        nodeOffset = shortcutIndex - currentPos;
                        break;
                    }
                    currentPos = nodeEnd;
                }
                
                if (textNode) {
                    // Replace the text
                    const nodeText = textNode.textContent;
                    const newText = nodeText.substring(0, nodeOffset) + 
                                  replacement + 
                                  nodeText.substring(nodeOffset + shortcut.length);
                    
                    textNode.textContent = newText;
                    
                    // Set cursor position
                    range.setStart(textNode, nodeOffset + replacement.length);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    console.log('Email Snippets: Successfully replaced in contenteditable element');
                    return true;
                }
            }
        } catch (error) {
            console.error('Email Snippets: Error in contenteditable replacement:', error);
        }
    }
    
    return false;
}

// Check for shortcuts and replace them
function checkAndReplace(element) {
    if (!isTextInput(element) || snippets.length === 0) {
        return;
    }
    
    const text = getElementValue(element);
    if (!text) return;
    
    // Check each snippet
    for (const snippet of snippets) {
        if (text.includes(snippet.shortcut)) {
            console.log('Email Snippets: Found shortcut:', snippet.shortcut);
            
            // Attempt replacement
            if (replaceShortcut(element, snippet.shortcut, snippet.text)) {
                break; // Only replace one shortcut at a time
            }
        }
    }
}

// Handle input events
function handleInput(event) {
    const element = event.target;
    console.log('Email Snippets: Input event on', element.tagName);
    
    // Small delay to ensure text is fully entered
    setTimeout(() => {
        checkAndReplace(element);
    }, 10);
}

// Handle key events that might trigger replacement
function handleKeyUp(event) {
    const element = event.target;
    
    // Only check on keys that typically end a word
    if ([' ', 'Enter', 'Tab'].includes(event.key)) {
        console.log('Email Snippets: Trigger key pressed:', event.key);
        
        setTimeout(() => {
            checkAndReplace(element);
        }, 50);
    }
}

// Add event listeners to existing elements
function addListenersToElement(element) {
    if (isTextInput(element) && !element.hasEmailSnippetListeners) {
        element.addEventListener('input', handleInput);
        element.addEventListener('keyup', handleKeyUp);
        element.hasEmailSnippetListeners = true;
        console.log('Email Snippets: Added listeners to', element.tagName);
    }
}

// Initial setup for existing elements
function setupExistingElements() {
    const elements = document.querySelectorAll('input, textarea, [contenteditable]');
    console.log('Email Snippets: Setting up', elements.length, 'existing elements');
    
    elements.forEach(addListenersToElement);
}

// Set up mutation observer for dynamic content
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Check the node itself
                addListenersToElement(node);
                
                // Check child elements
                const childInputs = node.querySelectorAll('input, textarea, [contenteditable]');
                childInputs.forEach(addListenersToElement);
            }
        });
    });
});

// Start everything when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupExistingElements();
        observer.observe(document.body, { childList: true, subtree: true });
    });
} else {
    setupExistingElements();
    observer.observe(document.body, { childList: true, subtree: true });
}

// Global event listeners as backup
document.addEventListener('input', handleInput, true);
document.addEventListener('keyup', handleKeyUp, true);

// Debug function for testing
window.emailSnippetsTest = function() {
    console.log('=== Email Snippets Debug Info ===');
    console.log('Snippets loaded:', snippets.length);
    console.log('Snippets:', snippets);
    
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    console.log('Found', inputs.length, 'input elements');
    
    if (snippets.length > 0) {
        console.log('Test this: Type "' + snippets[0].shortcut + '" followed by space');
    } else {
        console.log('No snippets found. Add some in the extension popup first.');
    }
    console.log('================================');
};

console.log('Email Snippets: Setup complete. Type emailSnippetsTest() to debug.');
