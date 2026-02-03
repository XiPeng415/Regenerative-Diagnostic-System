// Progressive data loader
(function() {
    'use strict';

    const LOADER_VERSION = '2026-02-03-Q4A1';
    window.LOADER_VERSION = LOADER_VERSION;

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

    function parseCSV(text) {
        const lines = text.replace(/\r/g, '').trim().split('\n');
        if (lines.length === 0) return [];
        const headers = [];
        const headerLine = lines[0];
        headerLine.replace(/("([^"]*)"|[^,]*)(,|$)/g, (m, val) => {
            const cleaned = val.replace(/^"|"$/g, '').trim();
            headers.push(cleaned);
            return '';
        });

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const values = [];
            line.replace(/("([^"]*)"|[^,]*)(,|$)/g, (m, val) => {
                const cleaned = val.replace(/^"|"$/g, '').trim();
                values.push(cleaned);
                return '';
            });
            if (values.length === 0) continue;
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] ?? '';
            });
            rows.push(row);
        }
        return rows;
    }

    async function loadCSV(url, description) {
        updateStatus(`Loading ${description}...`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.statusText}`);
            }
            const text = await response.text();
            const rows = parseCSV(text);
            updateStatus(`${description} loaded ✓`);
            return rows;
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
            
            updateStatus('Loading query data... (4/5 - Large file, please wait)');
            window.QUERY_DATA = await loadJSON('query_data.json', 'Query data');
            await new Promise(resolve => setTimeout(resolve, 100));

            updateStatus('Loading GPR density data... (5/6)');
            window.GPR_ROWS = await loadCSV('parcel normolized sum.csv', 'GPR density data');
            await new Promise(resolve => setTimeout(resolve, 100));

            updateStatus('Loading latent typology results... (6/7)');
            window.LATENT_TYPOLOGY_RESULTS = await loadJSON('latent_typologies.srj', 'Latent typology results');
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.LATENT_TYPOLOGY_RESULTS && window.LATENT_TYPOLOGY_RESULTS.results) {
                window.LATENT_TYPOLOGY_RESULTS_COUNT = window.LATENT_TYPOLOGY_RESULTS.results.bindings?.length || 0;
            } else {
                window.LATENT_TYPOLOGY_RESULTS_COUNT = 0;
            }

            updateStatus('Loading Q4A context results... (7/8)');
            window.Q4A_CONTEXT_RESULTS = await loadJSON('q4a_context.srj', 'Q4A context results');
            await new Promise(resolve => setTimeout(resolve, 100));

            updateStatus('Loading Q4B context summary... (8/8)');
            window.Q4B_CONTEXT_SUMMARY = await loadJSON('q4b_context_summary.srj', 'Q4B context summary');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Initialize the application
            updateStatus('Initializing interface...');
            
            if (typeof init === 'function') {
                init();
            }
            
            // Apply GPR_sum as Density score (replaces holistic density) before queries
            if (window.QUERY_DATA && window.QUERY_DATA.parcels && Array.isArray(window.GPR_ROWS)) {
                const gprMap = new Map();
                window.GPR_ROWS.forEach(row => {
                    const name = row.Name || row.name || row.parcelName;
                    const gprRaw = row.GPR_sum ?? row.gpr_sum ?? row.gpr;
                    const gpr = gprRaw !== undefined && gprRaw !== null && gprRaw !== '' ? parseFloat(gprRaw) : null;
                    if (name && gpr !== null && !Number.isNaN(gpr)) {
                        gprMap.set(name, gpr);
                    }
                });

                window.QUERY_DATA.parcels.forEach(p => {
                    const gpr = gprMap.get(p.label);
                    if (gpr !== undefined) {
                        p.GPR_sum = gpr;
                        p.DimensionScore_Density = gpr;
                    }
                });

                if (window.NETWORK_DATA && window.NETWORK_DATA.nodes) {
                    window.NETWORK_DATA.nodes.forEach(n => {
                        if (!n || !n.label) return;
                        const gpr = gprMap.get(n.label);
                        if (gpr === undefined) return;
                        if (!n.properties) n.properties = {};
                        n.properties.GPR_sum = gpr;
                        n.properties.DimensionScore_Density = gpr;
                        if (n.DimensionScore_Density !== undefined) n.DimensionScore_Density = gpr;
                    });
                }
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
