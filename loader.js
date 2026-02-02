// Progressive data loader
(function() {
    'use strict';
    
    const statusEl = document.getElementById('load-status');
    const loadingEl = document.getElementById('loading');
    
    function updateStatus(message) {
        if (statusEl) statusEl.textContent = message;
        console.log('Loading:', message);
    }
    
    // Load JSON file with progress
    async function loadJSON(url, description) {
        updateStatus(`Loading ${description}...`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.statusText}`);
            }
            
            const data = await response.json();
            updateStatus(`${description} loaded ✓`);
            return data;
        } catch (error) {
            console.error(`Error loading ${url}:`, error);
            updateStatus(`Error loading ${description}`);
            return null;
        }
    }
    
    // Main loading sequence
    async function loadAllData() {
        updateStatus('Initializing application...');
        
        try {
            // Load in sequence (not parallel) to show progress
            updateStatus('Loading network data... (1/4)');
            window.NETWORK_DATA = await loadJSON('network_data.json', 'Network data');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            updateStatus('Loading schema data... (2/4)');
            window.SCHEMA_DATA = await loadJSON('schema_data.json', 'Schema data');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            updateStatus('Loading diagram data... (3/4)');
            window.DIAGRAM_DATA = await loadJSON('diagram_data.json', 'Diagram data');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            updateStatus('Loading query data... (4/4 - Large file, please wait)');
            window.QUERY_DATA = await loadJSON('query_data.json', 'Query data');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Initialize the application
            updateStatus('Initializing interface...');
            
            if (typeof init === 'function') {
                init();
            }
            
            // Set queryData for queries
            if (window.QUERY_DATA) {
                window.queryData = window.QUERY_DATA;
            }
            
            updateStatus('Complete!');
            
            // Hide loading screen
            setTimeout(() => {
                if (loadingEl) {
                    loadingEl.style.display = 'none';
                }
            }, 500);
            
        } catch (error) {
            console.error('Loading error:', error);
            updateStatus('Error loading application');
            alert('Failed to load data files. Please ensure all files are in the same directory:\n' +
                  '- index.html\n' +
                  '- styles.css\n' +
                  '- app.js\n' +
                  '- loader.js\n' +
                  '- network_data.json\n' +
                  '- schema_data.json\n' +
                  '- diagram_data.json\n' +
                  '- query_data.json');
        }
    }
    
    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAllData);
    } else {
        loadAllData();
    }
})();
