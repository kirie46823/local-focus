// i18n Helper Functions
// Automatically replaces text content based on data-i18n attributes

function i18n(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions);
}

function localizeHtmlPage() {
  // Localize elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = i18n(key);
    
    if (message) {
      // Check if we should replace placeholder
      if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
        element.placeholder = message;
      } else {
        element.textContent = message;
      }
    }
  });
  
  // Localize placeholders with data-i18n-placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const message = i18n(key);
    
    if (message) {
      element.placeholder = message;
    }
  });
  
  // Localize titles with data-i18n-title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    const message = i18n(key);
    
    if (message) {
      element.title = message;
    }
  });
}

// Auto-execute on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', localizeHtmlPage);
} else {
  localizeHtmlPage();
}
