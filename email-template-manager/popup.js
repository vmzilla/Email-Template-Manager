document.addEventListener('DOMContentLoaded', function() {
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const snippetForm = document.getElementById('snippet-form');
    const snippetName = document.getElementById('snippet-name');
    const snippetShortcut = document.getElementById('snippet-shortcut');
    const snippetText = document.getElementById('snippet-text');
    const saveSnippetBtn = document.getElementById('save-snippet');
    const snippetsList = document.getElementById('snippets-list');
    const messageContainer = document.getElementById('message-container');

    let isFormVisible = false;
    let editingIndex = null;

    // Toggle form visibility
    toggleFormBtn.addEventListener('click', function() {
        isFormVisible = !isFormVisible;
        snippetForm.style.display = isFormVisible ? 'block' : 'none';
        toggleFormBtn.textContent = isFormVisible ? '❌ Cancel' : '➕ Add New Snippet';
        
        if (!isFormVisible) {
            clearForm();
            editingIndex = null;
        }
    });

    // Save snippet
    saveSnippetBtn.addEventListener('click', function() {
        const name = snippetName.value.trim();
        const shortcut = snippetShortcut.value.trim();
        const text = snippetText.value.trim();

        if (!name || !shortcut || !text) {
            showMessage('Please fill in all fields', 'error');
            return;
        }

        if (!shortcut.startsWith(';')) {
            showMessage('Shortcut must start with a semicolon (;)', 'error');
            return;
        }

        if (shortcut.length < 2) {
            showMessage('Shortcut must have at least one character after the semicolon', 'error');
            return;
        }

        chrome.storage.sync.get(['snippets'], function(result) {
            let snippets = result.snippets || [];
            
            // Check for duplicate shortcuts (but allow editing the same snippet)
            const existingIndex = snippets.findIndex(s => s.shortcut === shortcut);
            if (existingIndex !== -1 && existingIndex !== editingIndex) {
                showMessage('This shortcut is already in use', 'error');
                return;
            }

            const snippet = { name, shortcut, text };

            if (editingIndex !== null) {
                snippets[editingIndex] = snippet;
                showMessage('Snippet updated successfully!', 'success');
            } else {
                snippets.push(snippet);
                showMessage('Snippet saved successfully!', 'success');
            }

            chrome.storage.sync.set({ snippets }, function() {
                clearForm();
                loadSnippets();
                toggleForm();
            });
        });
    });

    // Clear form
    function clearForm() {
        snippetName.value = '';
        snippetShortcut.value = '';
        snippetText.value = '';
        editingIndex = null;
        saveSnippetBtn.textContent = '💾 Save Snippet';
    }

    // Toggle form
    function toggleForm() {
        isFormVisible = false;
        snippetForm.style.display = 'none';
        toggleFormBtn.textContent = '➕ Add New Snippet';
    }

    // Show message
    function showMessage(text, type) {
        messageContainer.innerHTML = `
            <div class="${type}-message">
                ${text}
            </div>
        `;
        
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 3000);
    }

    // Load and display snippets
    function loadSnippets() {
        chrome.storage.sync.get(['snippets'], function(result) {
            const snippets = result.snippets || [];
            
            if (snippets.length === 0) {
                snippetsList.innerHTML = `
                    <div class="empty-state">
                        <i>📝</i>
                        <p>No snippets yet!</p>
                        <p>Click "Add New Snippet" to get started</p>
                    </div>
                `;
                return;
            }

            snippetsList.innerHTML = snippets.map((snippet, index) => `
                <div class="snippet-item">
                    <div class="snippet-header">
                        <div class="snippet-name">${escapeHtml(snippet.name)}</div>
                        <div class="snippet-shortcut">${escapeHtml(snippet.shortcut)}</div>
                    </div>
                    <div class="snippet-preview">${escapeHtml(snippet.text.substring(0, 100))}${snippet.text.length > 100 ? '...' : ''}</div>
                    <div class="snippet-actions">
                        <button class="btn btn-secondary edit-btn" data-index="${index}">✏️ Edit</button>
                        <button class="btn btn-danger delete-btn" data-index="${index}">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');
            
            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    editSnippet(index);
                });
            });
            
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    deleteSnippet(index);
                });
            });
        });
    }

    // Edit snippet
    function editSnippet(index) {
        chrome.storage.sync.get(['snippets'], function(result) {
            const snippets = result.snippets || [];
            const snippet = snippets[index];
            
            if (snippet) {
                snippetName.value = snippet.name;
                snippetShortcut.value = snippet.shortcut;
                snippetText.value = snippet.text;
                editingIndex = index;
                
                isFormVisible = true;
                snippetForm.style.display = 'block';
                toggleFormBtn.textContent = '❌ Cancel';
                saveSnippetBtn.textContent = '💾 Update Snippet';
            }
        });
    }

    // Delete snippet
    function deleteSnippet(index) {
        if (confirm('Are you sure you want to delete this snippet?')) {
            chrome.storage.sync.get(['snippets'], function(result) {
                let snippets = result.snippets || [];
                snippets.splice(index, 1);
                
                chrome.storage.sync.set({ snippets }, function() {
                    showMessage('Snippet deleted successfully!', 'success');
                    loadSnippets();
                });
            });
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Load snippets on popup open
    loadSnippets();
});
