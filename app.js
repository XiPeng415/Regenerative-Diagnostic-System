
        let network = null;
        let nodes = null;
        let edges = null;
        let allNodes = [];
        let allEdges = [];
        let visibleTypes = new Set();
        let schemaData = null;
        
        // Network data placeholder
        let NETWORK_DATA = null;
        let SCHEMA_DATA = null;
        let DIAGRAM_DATA = null;

        // Diagram state
        let DIAGRAM_RENDERED = false;
        let diagramViewBox = { x: 0, y: 0, w: 1400, h: 800 };
        let diagramDrag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
        // Diagram filters + selection
        let diagramFilters = { subClass: true, objProps: true, dataProps: true };
        let diagramSelection = { type: null, name: null };
        // Diagram mode: 'summary' (featured view) or 'full' (all classes/properties)
        let diagramMode = 'full';
        
        function init() {
            // Data is loaded by loader.js into window.*
            NETWORK_DATA = window.NETWORK_DATA;
            SCHEMA_DATA = window.SCHEMA_DATA;
            DIAGRAM_DATA = window.DIAGRAM_DATA;
            QUERY_DATA = window.QUERY_DATA;
            queryData = window.QUERY_DATA;

            if (!NETWORK_DATA || !SCHEMA_DATA) {
                console.error('Missing NETWORK_DATA or SCHEMA_DATA. Make sure loader.js finished loading.');
                return;
            }

            allNodes = NETWORK_DATA.nodes;
            allEdges = NETWORK_DATA.edges;
            schemaData = SCHEMA_DATA;

            // Initialize visible types
            NETWORK_DATA.stats.node_types.forEach(type => visibleTypes.add(type));

            initNetwork();
            createLegend();
            renderSchema();
            renderOntologyDiagram();
            // Diagram UI controls
            const tSub = document.getElementById('toggleSubClass');
            const tObj = document.getElementById('toggleObjProps');
            const tDat = document.getElementById('toggleDataProps');
            const sInp = document.getElementById('diagramSearch');
            const tMode = document.getElementById('toggleDiagramMode');

            if (tSub) tSub.addEventListener('change', () => { diagramFilters.subClass = tSub.checked; resetDiagram(); });
            if (tObj) tObj.addEventListener('change', () => { diagramFilters.objProps = tObj.checked; resetDiagram(); });
            if (tDat) tDat.addEventListener('change', () => { diagramFilters.dataProps = tDat.checked; resetDiagram(); });

            if (sInp) {
                sInp.addEventListener('input', () => {
                    const q = (sInp.value || '').trim().toLowerCase();
                    highlightDiagram(q);
                });
            }
            if (tMode) {
                tMode.addEventListener('click', () => {
                    diagramMode = (diagramMode === 'summary') ? 'full' : 'summary';
                    tMode.textContent = (diagramMode === 'summary') ? 'Switch to Full Diagram' : 'Switch to Summary Diagram';
                    resetDiagram();
                });
                // initial label
                tMode.textContent = 'Switch to Summary Diagram';
            }

            document.getElementById('nodeCount').textContent = allNodes.length;
            document.getElementById('edgeCount').textContent = allEdges.length;
            document.getElementById('visibleNodes').textContent = allNodes.length;
        }
        
        function initNetwork() {
            const container = document.getElementById('network-canvas');
            
            const visNodes = allNodes.map(node => ({
                id: node.id,
                label: node.label,
                title: `${node.label}\nType: ${node.type}\nRCI: ${node.rci_score ? node.rci_score.toFixed(3) : 'N/A'}`,
                color: {
                    background: node.color,
                    border: node.color,
                    highlight: { background: '#e74c3c', border: '#c0392b' }
                },
                size: node.size || 15,
                font: { color: '#2c3e50', size: 11 },
                nodeType: node.type,
                nodeData: node
            }));
            
            const visEdges = allEdges.map((edge, idx) => ({
                id: idx,
                from: edge.from,
                to: edge.to,
                label: edge.label,
                arrows: 'to',
                color: { color: 'rgba(0,0,0,0.1)', highlight: '#3498db' },
                font: { color: '#7f8c8d', size: 9 },
                edgeData: edge
            }));
            
            nodes = new vis.DataSet(visNodes);
            edges = new vis.DataSet(visEdges);
            
            const data = { nodes: nodes, edges: edges };
            const options = {
                nodes: { shape: 'dot', borderWidth: 2, shadow: true },
                edges: { width: 1, smooth: { type: 'continuous' } },
                physics: {
                    enabled: true,
                    stabilization: { iterations: 200, updateInterval: 25 },
                    barnesHut: {
                        gravitationalConstant: -8000,
                        centralGravity: 0.3,
                        springLength: 150,
                        springConstant: 0.04,
                        damping: 0.09
                    }
                },
                interaction: { hover: true, tooltipDelay: 100, hideEdgesOnDrag: true }
            };
            
            network = new vis.Network(container, data, options);
            
            network.on('click', function(params) {
                if (params.nodes.length > 0) {
                    showNodeInfo(params.nodes[0]);
                } else if (params.edges.length > 0) {
                    showEdgeInfo(params.edges[0]);
                } else {
                    closeSidebar();
                }
            });
            
            network.on('selectNode', params => {
                document.getElementById('selectedInfo').textContent = `${params.nodes.length} node(s)`;
            });
            
            network.on('deselectNode', () => {
                document.getElementById('selectedInfo').textContent = 'None';
            });
        }
        
        function showNodeInfo(nodeId) {
            const node = allNodes.find(n => n.id === nodeId);
            if (!node) return;
            
            const sidebar = document.getElementById('sidebar');
            const title = document.getElementById('sidebarTitle');
            const content = document.getElementById('sidebarContent');
            
            title.textContent = node.label;
            
            let html = '<div class="info-section">';
            html += '<h3>Basic Information</h3>';
            html += `<div class="info-item"><div class="info-label">Node ID</div><div class="info-value">${node.label}</div></div>`;
            html += `<div class="info-item"><div class="info-label">Type</div><div class="info-value">${node.type}</div></div>`;
            if (node.rci_score) {
                html += `<div class="info-item"><div class="info-label">RCI Score</div><div class="info-value">${node.rci_score.toFixed(3)}</div></div>`;
            }
            html += '</div>';
            
            // Connectivity
            const conn = node.connectivity || { total: 0 };
            html += '<div class="info-section">';
            html += '<h3>Connections</h3>';
            html += `<div class="info-item"><div class="info-label">Connected to</div><div class="info-value">${conn.total} nodes</div></div>`;
            html += '</div>';
            
            // Key Properties
            if (node.properties) {
                html += '<div class="info-section">';
                html += '<h3>Key Properties</h3>';
                const keyProps = ['DimensionScore_Ecological', 'DimensionScore_Social', 'DimensionScore_Mobility', 'DimensionScore_Density'];
                keyProps.forEach(prop => {
                    if (node.properties[prop]) {
                        const value = parseFloat(node.properties[prop]);
                        html += `<div class="info-item"><div class="info-label">${prop}</div><div class="info-value">${value.toFixed(3)}</div></div>`;
                    }
                });
                html += '</div>';
            }
            
            content.innerHTML = html;
            sidebar.classList.add('show');

            // Show mini-map with this node
            console.log('[Network View] About to call showNetworkMiniMap with nodeId:', nodeId);
            if (typeof showNetworkMiniMap === 'function') {
                showNetworkMiniMap(nodeId);
            } else {
                console.error('[Network View] showNetworkMiniMap is not a function!', typeof showNetworkMiniMap);
            }
        }

        function showEdgeInfo(edgeId) {
            const edge = allEdges.find(e => allEdges.indexOf(e) === edgeId);
            if (!edge) return;
            
            const fromNode = allNodes.find(n => n.id === edge.from);
            const toNode = allNodes.find(n => n.id === edge.to);
            
            const sidebar = document.getElementById('sidebar');
            const title = document.getElementById('sidebarTitle');
            const content = document.getElementById('sidebarContent');
            
            title.textContent = 'Relationship Details';
            
            let html = '<div class="info-section">';
            html += '<h3>Relationship Information</h3>';
            html += `<div class="info-item"><div class="info-label">Type</div><div class="info-value">${edge.label}</div></div>`;
            html += `<div class="info-item"><div class="info-label">From</div><div class="info-value">${fromNode ? fromNode.label : 'Unknown'}</div></div>`;
            html += `<div class="info-item"><div class="info-label">To</div><div class="info-value">${toNode ? toNode.label : 'Unknown'}</div></div>`;
            html += '</div>';

            content.innerHTML = html;
            sidebar.classList.add('show');

            // Hide mini-map for edge info (edges don't have locations)
            hideNetworkMiniMap();
        }

        function createLegend() {
            const legendContent = document.getElementById('legendContent');
            const types = NETWORK_DATA.stats.node_types;
            const typeCounts = {};
            allNodes.forEach(n => {
                typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
            });
            
            let html = '';
            types.forEach(type => {
                const node = allNodes.find(n => n.type === type);
                const color = node ? node.color : '#757575';
                const count = typeCounts[type] || 0;
                
                html += `<div class="legend-item">
                    <input type="checkbox" class="checkbox-input" id="type-${type}" checked onchange="toggleType('${type}')">
                    <div class="legend-color" style="background: ${color}"></div>
                    <span class="legend-label">${type}</span>
                    <span class="legend-count">(${count})</span>
                </div>`;
            });
            
            legendContent.innerHTML = html;
        }
        
        function toggleType(type) {
            const checkbox = document.getElementById(`type-${type}`);
            if (checkbox.checked) {
                visibleTypes.add(type);
            } else {
                visibleTypes.delete(type);
            }
            filterNodes();
        }
        
        function filterNodes() {
            const filteredNodes = allNodes.filter(node => visibleTypes.has(node.type));
            const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
            const filteredEdges = allEdges.filter(edge => 
                filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
            );
            
            nodes.clear();
            edges.clear();
            
            filteredNodes.forEach(node => {
                nodes.add({
                    id: node.id,
                    label: node.label,
                    title: `${node.label}\nType: ${node.type}\nRCI: ${node.rci_score ? node.rci_score.toFixed(3) : 'N/A'}`,
                    color: { background: node.color, border: node.color, highlight: { background: '#e74c3c', border: '#c0392b' } },
                    size: node.size || 15,
                    font: { color: '#2c3e50', size: 11 },
                    nodeType: node.type,
                    nodeData: node
                });
            });
            
            filteredEdges.forEach((edge, idx) => {
                edges.add({
                    id: idx,
                    from: edge.from,
                    to: edge.to,
                    label: edge.label,
                    arrows: 'to',
                    color: { color: 'rgba(0,0,0,0.1)', highlight: '#3498db' },
                    font: { color: '#7f8c8d', size: 9 }
                });
            });
            
            document.getElementById('visibleNodes').textContent = filteredNodes.length;
        }
        
        function renderSchema() {
            renderClassHierarchy();
            renderClasses();
            renderProperties();
        }
        
        function renderClassHierarchy() {
            const container = document.getElementById('classHierarchy');
            const classes = schemaData.classes;
            
            let html = '<div class="tree-node"><div class="tree-node-name">owl:Thing (Root)</div>';
            
            Object.keys(classes).forEach(className => {
                const cls = classes[className];
                if (!cls.subClassOf || cls.subClassOf.length === 0) {
                    html += renderTreeNode(className, cls, classes, 0);
                }
            });
            
            html += '</div>';
            container.innerHTML = html;
        }
        
        function renderTreeNode(className, cls, allClasses, level) {
            let html = `<div class="tree-node">`;
            html += `<div class="tree-node-name">${className}</div>`;
            html += `<div class="tree-node-info">${cls.label || ''} (${cls.instances_count} instances)</div>`;
            
            // Find children
            Object.keys(allClasses).forEach(childName => {
                const child = allClasses[childName];
                if (child.subClassOf && child.subClassOf.includes(className)) {
                    html += renderTreeNode(childName, child, allClasses, level + 1);
                }
            });
            
            html += '</div>';
            return html;
        }
        
        function renderClasses() {
            const container = document.getElementById('classList');
            const classes = schemaData.classes;
            
            let html = '';
            Object.keys(classes).forEach(className => {
                const cls = classes[className];
                html += `<div class="class-card">
                    <div class="class-name">${className}</div>
                    <div class="class-label">${cls.label || 'No description'}</div>
                    ${cls.comment ? `<div class="class-label">${cls.comment}</div>` : ''}
                    <div class="class-meta">
                        <div class="meta-item"><strong>Instances:</strong> ${cls.instances_count}</div>
                        ${cls.subClassOf.length > 0 ? `<div class="meta-item"><strong>Parent:</strong> ${cls.subClassOf.join(', ')}</div>` : ''}
                    </div>
                </div>`;
            });
            
            container.innerHTML = html;
        }
        
        function renderProperties() {
            const container = document.getElementById('propertyList');
            const properties = schemaData.properties;
            
            let html = '';
            Object.keys(properties).forEach(propName => {
                const prop = properties[propName];
                html += `<div class="property-card">
                    <div class="property-name">${propName}</div>
                    <span class="property-type ${prop.type === 'ObjectProperty' ? 'object' : 'datatype'}">
                        ${prop.type}
                    </span>
                    <div class="property-details">${prop.label || 'No description'}</div>
                    ${prop.domain.length > 0 ? `<div class="property-details"><strong>Domain:</strong> ${prop.domain.join(', ')}</div>` : ''}
                    ${prop.range.length > 0 ? `<div class="property-details"><strong>Range:</strong> ${prop.range.join(', ')}</div>` : ''}
                </div>`;
            });
            
            container.innerHTML = html;
        }
        
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            if (searchTerm === '') {
                network.selectNodes([]);
                return;
            }
            
            const matchingNodes = allNodes
                .filter(node => node.label.toLowerCase().includes(searchTerm))
                .map(node => node.id);
            
            if (matchingNodes.length > 0) {
                network.selectNodes(matchingNodes);
                network.focus(matchingNodes[0], { scale: 1.5, animation: true });
            }
        });
        
        function switchPage(pageName, evt) {
            const eventObj = evt || window.event;

            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

            document.getElementById(`${pageName}-page`).classList.add('active');
            if (eventObj && eventObj.target) {
                eventObj.target.classList.add('active');
            }

            // Ensure diagram is rendered when user opens that tab
            if (pageName === 'diagram') {
                resetDiagram();
                const sInp = document.getElementById('diagramSearch');
                if (sInp) sInp.focus();
            }
        }
        
        function resetView() {
            network.fit({ animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
        }
        
        function fitNetwork() {
            network.fit();
        }
        
        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('show');
            network.unselectAll();
            // Hide network mini-map
            hideNetworkMiniMap();
        }
        
        function toggleLegend() {
            const legend = document.getElementById('legendPanel');
            legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
        }

        function renderOntologyDiagram() {
            if (!schemaData || !schemaData.classes || !schemaData.properties) {
                console.warn('Schema data not ready yet for diagram.');
                return;
            }

            const svg = document.getElementById('ontology-diagram');
            if (!svg) return;

            // Prefer using diagram_data.json if present (more detailed + stable layout)
            const diagramData = DIAGRAM_DATA || window.DIAGRAM_DATA;
            if (diagramData && Array.isArray(diagramData.nodes) && diagramData.nodes.length) {
                // clear
                while (svg.firstChild) svg.removeChild(svg.firstChild);
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                // viewBox from data (fallback)
                const vb = (diagramData.layout && diagramData.layout.viewBox) ? diagramData.layout.viewBox : { x: 0, y: 0, w: 2100, h: 1200 };
                diagramViewBox = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
                svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);

                // helpers
                function el(name, attrs = {}) {
                    const e = document.createElementNS('http://www.w3.org/2000/svg', name);
                    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
                    return e;
                }

                // markers
                const defs = el('defs');
                const mk = el('marker', { id: 'arrow', markerWidth: '10', markerHeight: '10', refX: '8', refY: '3', orient: 'auto' });
                mk.appendChild(el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: 'rgba(0,0,0,0.65)' }));
                defs.appendChild(mk);
                const mk2 = el('marker', { id: 'arrowLight', markerWidth: '10', markerHeight: '10', refX: '8', refY: '3', orient: 'auto' });
                mk2.appendChild(el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: 'rgba(0,0,0,0.28)' }));
                defs.appendChild(mk2);
                svg.appendChild(defs);

                // background
                svg.appendChild(el('rect', { x: diagramViewBox.x, y: diagramViewBox.y, width: diagramViewBox.w, height: diagramViewBox.h, fill: 'white' }));

                // index
                const nodeById = {};
                diagramData.nodes.forEach(n => { nodeById[n.id] = n; });

                // group headings (optional)
                const groups = {};
                diagramData.nodes.forEach(n => {
                    const g = n.group || 'Other';
                    if (!groups[g]) groups[g] = { minX: n.x, minY: n.y };
                    groups[g].minX = Math.min(groups[g].minX, n.x);
                    groups[g].minY = Math.min(groups[g].minY, n.y);
                });
                Object.keys(groups).forEach(g => {
                    const t = el('text', { x: groups[g].minX, y: groups[g].minY - 18, 'font-size': '13', 'font-weight': '700', fill: 'rgba(0,0,0,0.55)' });
                    t.textContent = g;
                    svg.appendChild(t);
                });

                // draw edges first
                (diagramData.edges || []).forEach(e0 => {
                    const a = nodeById[e0.from];
                    const b = nodeById[e0.to];
                    if (!a || !b) return;

                    const x1 = a.x + a.w;
                    const y1 = a.y + a.h / 2;
                    const x2 = b.x;
                    const y2 = b.y + b.h / 2;

                    const dashed = (e0.type === 'subClassOf');
                    const light = dashed;

                    const path = el('path', {
                        d: `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`,
                        fill: 'none',
                        stroke: light ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.55)',
                        'stroke-width': light ? '2' : '2.2',
                        'marker-end': light ? 'url(#arrowLight)' : 'url(#arrow)'
                    });
                    if (dashed) path.setAttribute('stroke-dasharray', '6 6');
                    svg.appendChild(path);

                    const tx = (x1 + x2) / 2;
                    const ty = (y1 + y2) / 2 + (light ? -10 : 14);
                    const lab = el('text', { x: tx, y: ty, 'font-size': '12', fill: light ? 'rgba(0,0,0,0.40)' : 'rgba(0,0,0,0.70)' });
                    lab.textContent = e0.label || e0.type;
                    lab.style.cursor = 'pointer';
                    lab.addEventListener('click', () => {
                        const p = (schemaData && schemaData.properties) ? schemaData.properties[lab.textContent] : null;
                        if (p) {
                            setDetails(lab.textContent,
                                [p.type],
                                {
                                    label: p.label || '-',
                                    domain: (p.domain || []).join(', ') || '-',
                                    range: (p.range || []).join(', ') || '-'
                                },
                                '',
                                []
                            );
                        } else {
                            setDetails(lab.textContent, ['Edge'], { from: e0.from, to: e0.to, type: e0.type }, '', []);
                        }
                    });
                    svg.appendChild(lab);
                });

                // draw nodes
                diagramData.nodes.forEach(n => {
                    const g = el('g', { 'data-diagram-id': n.id });
                    const rect = el('rect', {
                        x: n.x, y: n.y, width: n.w, height: n.h, rx: 12, ry: 12,
                        fill: 'white',
                        stroke: 'rgba(0,0,0,0.35)',
                        'stroke-width': '1.5'
                    });
                    g.appendChild(rect);

                    const title = el('text', { x: n.x + 14, y: n.y + 22, 'font-size': '14', 'font-weight': '700', fill: 'rgba(0,0,0,0.86)' });
                    title.textContent = n.label || n.id;
                    g.appendChild(title);

                    const sub = (n.meta && n.meta.label) ? String(n.meta.label) : '';
                    if (sub) {
                        const subtitle = el('text', { x: n.x + 14, y: n.y + 42, 'font-size': '12', fill: 'rgba(0,0,0,0.55)' });
                        subtitle.textContent = sub;
                        g.appendChild(subtitle);
                    }

                    // hover
                    g.style.cursor = 'pointer';
                    g.addEventListener('mouseenter', () => {
                        rect.setAttribute('stroke', 'rgba(52,152,219,0.95)');
                        rect.setAttribute('stroke-width', '2.4');
                    });
                    g.addEventListener('mouseleave', () => {
                        rect.setAttribute('stroke', 'rgba(0,0,0,0.35)');
                        rect.setAttribute('stroke-width', '1.5');
                    });

                    // click => details (include datatype properties)
                    g.addEventListener('click', () => {
                        const meta = n.meta || {};
                        const dps = Array.isArray(meta.datatypeProperties) ? meta.datatypeProperties : [];
                        setDetails(n.id,
                            ['Class'],
                            {
                                label: meta.label || '-',
                                instances: (meta.instances_count !== undefined ? meta.instances_count : 0),
                                comment: meta.comment || '-'
                            },
                            'datatypeProperties',
                            (dps.length ? dps : ['(none)'])
                        );
                    });

                    svg.appendChild(g);
                });

                // pan/zoom
                bindPanZoom(svg);

                // default details
                setDetails('Ontology Diagram', ['Interactive'], {
                    mode: 'diagram_data.json',
                    hint: 'Mouse wheel to zoom; drag to pan. Click nodes/edge labels for details.'
                }, '', []);

                DIAGRAM_RENDERED = true;
                return;
            }

            // Always full re-render (because filters/search can change)
            DIAGRAM_RENDERED = false;

            while (svg.firstChild) svg.removeChild(svg.firstChild);
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            // Helpers
            function el(name, attrs = {}) {
                const e = document.createElementNS('http://www.w3.org/2000/svg', name);
                Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
                return e;
            }

            function bindPanZoom(svg) {
                // Avoid stacking multiple listeners on re-render
                svg.onwheel = (e) => {
                    e.preventDefault();
                    const scale = (e.deltaY < 0) ? 0.9 : 1.1;
                    diagramViewBox.w *= scale;
                    diagramViewBox.h *= scale;
                    svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);
                };

                svg.onmousedown = (e) => {
                    diagramDrag.active = true;
                    diagramDrag.startX = e.clientX;
                    diagramDrag.startY = e.clientY;
                    diagramDrag.origX = diagramViewBox.x;
                    diagramDrag.origY = diagramViewBox.y;
                };

                window.onmousemove = (e) => {
                    if (!diagramDrag.active) return;
                    const dx = e.clientX - diagramDrag.startX;
                    const dy = e.clientY - diagramDrag.startY;
                    const kx = diagramViewBox.w / svg.clientWidth;
                    const ky = diagramViewBox.h / svg.clientHeight;
                    diagramViewBox.x = diagramDrag.origX - dx * kx;
                    diagramViewBox.y = diagramDrag.origY - dy * ky;
                    svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);
                };

                window.onmouseup = () => { diagramDrag.active = false; };
            }

            function setDetails(title, chips = [], kv = {}, listTitle = '', listItems = []) {
                const panel = document.getElementById('diagramDetails');
                if (!panel) return;
                const body = panel.querySelector('.details-body');
                if (!body) return;

                const chipsHtml = chips.map(c => `<span class="details-chip" style="display: inline-block; background: #3498db; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-right: 6px; margin-bottom: 6px;">${c}</span>`).join('');
                const kvHtml = Object.keys(kv).length
                    ? `<div class="details-kv" style="margin-top: 10px;">${Object.entries(kv).map(([k,v]) => `<div style="margin-bottom: 8px;"><span class="details-k" style="font-weight: 700; color: #555;">${k}:</span> <span style="color: #333;">${v}</span></div>`).join('')}</div>`
                    : '';
                const listHtml = (listItems && listItems.length)
                    ? `<div style="margin-top:10px;"><div class="details-k" style="font-weight: 700; color: #555; margin-bottom: 6px;">${listTitle}</div><ul class="details-list" style="margin: 0; padding-left: 20px; color: #333;">${listItems.map(i => `<li style="margin-bottom: 4px;">${i}</li>`).join('')}</ul></div>`
                    : '';

                body.innerHTML = `<div style="font-weight:700; margin-bottom:10px; font-size: 16px; color: #2c3e50;">${title}</div>${chipsHtml}${kvHtml}${listHtml}`;
                panel.style.display = 'block';
            }

            // Build class index
            const classes = schemaData.classes;
            const props = schemaData.properties;

            // Normalize names from prefixed forms (e.g., regen:ResidentialParcel) or IRIs to local names
            function normName(x) {
                if (!x) return '';
                const s = String(x);
                const byHash = s.split('#');
                const lastHash = byHash[byHash.length - 1];
                const bySlash = lastHash.split('/');
                const lastSlash = bySlash[bySlash.length - 1];
                const byColon = lastSlash.split(':');
                return byColon[byColon.length - 1].trim();
            }
            function sameName(a, b) {
                return normName(a).toLowerCase() === normName(b).toLowerCase();
            }
            function nameIncludes(a, b) {
                return normName(a).toLowerCase().includes(normName(b).toLowerCase());
            }

            // Fallback domain/range mappings from OWL file
            const propertyDomainRangeFallback = {
                'hasNearestBusStation': { domain: 'ResidentialParcel', range: 'BusStation' },
                'hasNearestChildCare': { domain: 'ResidentialParcel', range: 'ChildCareService' },
                'hasNearestSocialService': { domain: 'ResidentialParcel', range: 'SocialServiceAgency' },
                'hasNearestSportFacility': { domain: 'ResidentialParcel', range: 'SportFacility' },
                'hasFacilityRelation': { domain: 'ResidentialParcel', range: 'ParcelFacilityRelation' },
                'hasProximityRelation': { domain: 'ResidentialParcel', range: 'ParcelProximityRelation' },
                'connectsParcel': { domain: 'ParcelFacilityRelation', range: 'ResidentialParcel' },
                'connectsFacility': { domain: 'ParcelFacilityRelation', range: 'PublicFacility' },
                'connectsParcel1': { domain: 'ParcelProximityRelation', range: 'ResidentialParcel' },
                'connectsParcel2': { domain: 'ParcelProximityRelation', range: 'ResidentialParcel' },
                'isNeighborOf': { domain: 'ResidentialParcel', range: 'ResidentialParcel' },
                'hasDistanceValue': { domain: 'ParcelFacilityRelation', range: 'float' }
            };

            // Index properties by normalized domain for fast lookup (used by full diagram)
            const dataPropsByDomain = {};
            const objProps = [];
            Object.keys(props).forEach(pn => {
                const p = props[pn];
                if (!p) return;
                if (p.type === 'DatatypeProperty') {
                    let domains = p.domain || [];
                    // Fallback: if domain is empty, check fallback map or assume ResidentialParcel
                    if (domains.length === 0) {
                        const fb = propertyDomainRangeFallback[pn];
                        if (fb && fb.domain) {
                            domains = [fb.domain];
                        } else {
                            // Most datatype properties in this ontology belong to ResidentialParcel
                            domains = ['ResidentialParcel'];
                        }
                    }
                    domains.forEach(d => {
                        const k = normName(d);
                        if (!dataPropsByDomain[k]) dataPropsByDomain[k] = [];
                        dataPropsByDomain[k].push(pn);
                    });
                } else if (p.type === 'ObjectProperty') {
                    // Add fallback domain/range if missing
                    let pCopy = { ...p };
                    if ((!pCopy.domain || pCopy.domain.length === 0 || !pCopy.range || pCopy.range.length === 0)) {
                        const fb = propertyDomainRangeFallback[pn];
                        if (fb) {
                            if (!pCopy.domain || pCopy.domain.length === 0) pCopy.domain = [fb.domain];
                            if (!pCopy.range || pCopy.range.length === 0) pCopy.range = [fb.range];
                        }
                    }
                    objProps.push({ name: pn, p: pCopy });
                }
            });

            function hasClass(namePart) {
                const np = String(namePart || '').toLowerCase();
                return Object.keys(classes).find(k => normName(k).toLowerCase().includes(np)) || null;
            }

            // Key classes we want to feature (best effort matching)
            const clsResidential = hasClass('ResidentialParcel') || hasClass('Parcel') || Object.keys(classes)[0];
            const clsPFR = hasClass('ParcelFacilityRelation');
            const clsPublicFacility = hasClass('PublicFacility');
            const clsSocialFacility = hasClass('SocialFacility');
            const clsChildCare = hasClass('ChildCare');

            // Left: typology subclasses of ResidentialParcel
            const typologySubs = Object.keys(classes).filter(cn => {
                const sc = classes[cn].subClassOf || [];
                return clsResidential && sc.some(p => sameName(p, clsResidential));
            }).sort((a,b) => a.localeCompare(b));

            // Right: datatype indicators for ResidentialParcel - use dataPropsByDomain which has fallback logic
            const parcelDataProps = (dataPropsByDomain[normName(clsResidential)] || []).slice().sort((a,b) => a.localeCompare(b));

            // ParcelFacilityRelation props (datatype) - use dataPropsByDomain which has fallback logic
            const pfrDataProps = clsPFR ? (dataPropsByDomain[normName(clsPFR)] || []).slice().sort((a,b) => a.localeCompare(b)) : [];

            // Object properties between featured classes
            const objEdges = Object.keys(props).filter(pn => {
                const p = props[pn];
                if (p.type !== 'ObjectProperty') return false;
                if (!p.domain || !p.range || p.domain.length === 0 || p.range.length === 0) return false;
                return true;
            }).map(pn => ({ name: pn, p: props[pn] }));

            // =====================
            // FULL DIAGRAM MODE - COMPACT DRAGGABLE LAYOUT
            // =====================
            if (diagramMode === 'full') {
                const WFULL = 4000;    // Compact canvas width
                const HFULL = 5000;    // Compact canvas height
                diagramViewBox = { x: 0, y: 0, w: WFULL, h: HFULL };
                svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);

                // Build parent->children adjacency (normalize comparisons)
                const parents = {};
                const children = {};
                Object.keys(classes).forEach(cn => {
                    const sc = classes[cn].subClassOf || [];
                    if (!parents[cn]) parents[cn] = [];
                    sc.forEach(p => {
                        const parentKey = Object.keys(classes).find(k => sameName(k, p));
                        if (parentKey) {
                            if (!children[parentKey]) children[parentKey] = [];
                            children[parentKey].push(cn);
                            parents[cn].push(parentKey);
                        }
                    });
                });

                // Roots: no recognized parent
                const roots = Object.keys(classes).filter(cn => (parents[cn] || []).length === 0).sort((a,b) => a.localeCompare(b));

                // Compute depth with BFS
                const depth = {};
                const queue = [];
                roots.forEach(r => { depth[r] = 0; queue.push(r); });
                while (queue.length) {
                    const cur = queue.shift();
                    const d0 = depth[cur] || 0;
                    (children[cur] || []).forEach(ch => {
                        const nd = d0 + 1;
                        if (depth[ch] === undefined || nd < depth[ch]) {
                            depth[ch] = nd;
                            queue.push(ch);
                        }
                    });
                }

                // Order nodes by (depth, name)
                const ordered = Object.keys(classes)
                    .sort((a,b) => (depth[a] - depth[b]) || a.localeCompare(b));

                // Layout constants - Minimal boxes that fit content
                const colW = 600;        // Column width for arrow space
                const minBoxW = 280;     // Minimum box width
                const maxBoxW = 400;     // Maximum box width
                const marginX = 80;      // Left margin
                const marginY = 80;      // Top margin
                const minGapY = 60;      // Gap between boxes

                // Place nodes by columns (depth) and rows within each depth
                const rowsByDepth = {};
                ordered.forEach(cn => {
                    const d = depth[cn] ?? 0;
                    if (!rowsByDepth[d]) rowsByDepth[d] = [];
                    rowsByDepth[d].push(cn);
                });

                const boxByClass = {};
                const boxPositions = {};  // Store custom positions for dragged boxes
                const arrowElements = [];  // Store arrow elements for redrawing
                // Track current Y position for each column to avoid overlaps
                const colYPos = {};

                // Draw class boxes with all (or many) datatype props inside
                Object.keys(rowsByDepth).map(x => parseInt(x,10)).sort((a,b)=>a-b).forEach(d => {
                    const arr = rowsByDepth[d];
                    if (!colYPos[d]) colYPos[d] = marginY;

                    arr.forEach(cn => {
                        const x = marginX + d * colW;
                        const y = colYPos[d];

                        const local = normName(cn);
                        const dp = (dataPropsByDomain[local] || []).slice().sort((a,b)=>a.localeCompare(b));
                        // SHOW ALL PROPERTIES - no limit
                        const shown = dp;

                        // Calculate box width based on content
                        const longestProp = shown.length > 0 ? Math.max(...shown.map(p => p.length)) : local.length;
                        const estimatedWidth = Math.min(maxBoxW, Math.max(minBoxW, longestProp * 7 + 50));
                        const boxW = estimatedWidth;

                        // Calculate box height to fit ALL properties compactly
                        const baseHeight = 70;           // Base height for class name + label
                        const propLineHeight = 16;       // Height per property line
                        const headerHeight = 20;         // Height for "properties" header
                        const padding = 15;              // Bottom padding
                        const h = baseHeight + (shown.length ? (headerHeight + shown.length * propLineHeight + padding) : 0);

                        const box = drawBox(`full:${cn}`, x, y, boxW, h, local, classes[cn].label ? String(classes[cn].label).slice(0, 80) : '', { fill: 'white' });
                        box.offsetX = 0;
                        box.offsetY = 0;
                        boxByClass[cn] = box;

                        // Update Y position for next box in this column
                        colYPos[d] = y + h + minGapY;

                        // datatype props list - ADD TO BOX GROUP with ABSOLUTE coords
                        if (diagramFilters.dataProps && dp.length) {
                            let ty = y + 70;  // Absolute coordinates!
                            const head = el('text', { x: x + 10, y: ty, 'font-size': '11', 'font-weight': '700', fill: 'rgba(0,0,0,0.65)' });
                            head.textContent = `properties (${shown.length})`;
                            box.g.appendChild(head);
                            ty += 20;
                            shown.forEach(pn => {
                                const t = el('text', { x: x + 12, y: ty, 'font-size': '10', fill: 'rgba(0,0,0,0.85)' });
                                t.textContent = pn;
                                t.style.cursor = 'pointer';
                                t.addEventListener('click', (e) => {
                                    e.stopPropagation();  // Prevent box drag
                                    const p = props[pn];
                                    setDetails(pn,
                                        [p.type],
                                        { label: p.label || '-', domain: (p.domain || []).join(', ') || '-', range: (p.range || []).join(', ') || '-' },
                                        '', []
                                    );
                                });
                                box.g.appendChild(t);
                                ty += 16;
                            });
                        }
                    });
                });

                // Draw subClassOf edges WITH LABELS
                if (diagramFilters.subClass) {
                    ordered.forEach(cn => {
                        const ps = parents[cn] || [];
                        ps.forEach(pn => {
                            const a = boxByClass[pn];
                            const b = boxByClass[cn];
                            if (!a || !b) return;
                            const arrowData = { from: pn, to: cn, label: 'subClassOf', dashed: true, light: true };
                            arrowElements.push(arrowData);
                            drawArrow(a.x + a.offsetX + a.w, a.y + a.offsetY + a.h/2, b.x + b.offsetX, b.y + b.offsetY + b.h/2, 'subClassOf', true, true, true);
                        });
                    });
                }

                // Draw object property edges WITH LABELS
                if (diagramFilters.objProps) {
                    objProps.forEach(({ name, p }) => {
                        const d0 = (p.domain && p.domain.length) ? p.domain[0] : null;
                        const r0 = (p.range && p.range.length) ? p.range[0] : null;
                        if (!d0 || !r0) return;
                        const domKey = Object.keys(classes).find(k => sameName(k, d0));
                        const ranKey = Object.keys(classes).find(k => sameName(k, r0));
                        if (!domKey || !ranKey) return;
                        const a = boxByClass[domKey];
                        const b = boxByClass[ranKey];
                        if (!a || !b) return;

                        // Draw all nearby connections WITH LABELS
                        const depthA = depth[domKey] ?? 0;
                        const depthB = depth[ranKey] ?? 0;
                        const depthDiff = Math.abs(depthA - depthB);
                        const vertDist = Math.abs(a.y - b.y);

                        // Draw if reasonably close
                        if (depthDiff <= 2 || vertDist < 800) {
                            const arrowData = { from: domKey, to: ranKey, label: name, dashed: false, light: false };
                            arrowElements.push(arrowData);
                            drawArrow(a.x + a.offsetX + a.w, a.y + a.offsetY + a.h/2, b.x + b.offsetX, b.y + b.offsetY + b.h/2, name, false, false, true);
                        }
                    });
                }

                // Function to redraw all arrows based on current box positions
                function redrawAllArrows() {
                    // Remove all existing arrows
                    const arrows = svg.querySelectorAll('path[data-arrow="true"], rect[data-arrow-bg="true"], text[data-arrow-label="true"]');
                    arrows.forEach(el => el.remove());

                    // Redraw all arrows
                    arrowElements.forEach(({ from, to, label, dashed, light }) => {
                        const a = boxByClass[from];
                        const b = boxByClass[to];
                        if (!a || !b) return;
                        drawArrow(
                            a.x + a.offsetX + a.w,
                            a.y + a.offsetY + a.h/2,
                            b.x + b.offsetX,
                            b.y + b.offsetY + b.h/2,
                            label,
                            dashed,
                            light,
                            true
                        );
                    });
                }

                // Make all boxes draggable
                let draggedBox = null;
                let dragStartX = 0;
                let dragStartY = 0;

                Object.keys(boxByClass).forEach(cn => {
                    const box = boxByClass[cn];
                    const boxGroup = box.g;

                    boxGroup.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        draggedBox = box;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                        dragStartX = svgP.x - box.offsetX;
                        dragStartY = svgP.y - box.offsetY;
                        boxGroup.style.cursor = 'grabbing';
                        e.stopPropagation();
                        e.preventDefault();
                    });
                });

                svg.addEventListener('mousemove', (e) => {
                    if (!draggedBox) return;
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

                    draggedBox.offsetX = svgP.x - dragStartX;
                    draggedBox.offsetY = svgP.y - dragStartY;

                    draggedBox.g.setAttribute('transform', `translate(${draggedBox.offsetX}, ${draggedBox.offsetY})`);
                    redrawAllArrows();
                    e.preventDefault();
                });

                svg.addEventListener('mouseup', () => {
                    if (draggedBox) {
                        draggedBox.g.style.cursor = 'move';
                        draggedBox = null;
                    }
                });

                // Set cursor for all boxes
                Object.keys(boxByClass).forEach(cn => {
                    boxByClass[cn].g.style.cursor = 'move';
                });

                // default details
                setDetails('Full Ontology Diagram', ['Interactive - Drag boxes to rearrange'], {
                    mode: 'full',
                    hint: 'Drag boxes to move them. Mouse wheel to zoom. Pan with right-click drag.'
                }, '', []);

                bindPanZoom(svg);

                DIAGRAM_RENDERED = true;
                return;
            }

            // --- Presentation layout coordinates ---
            const W = 1800;
            const H = 1000;
            diagramViewBox = { x: 0, y: 0, w: W, h: H };
            svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);

            // Background groups
            const bg = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'white' });
            svg.appendChild(bg);

            // Markers
            const defs = el('defs');
            const mk = el('marker', { id: 'arrow', markerWidth: '10', markerHeight: '10', refX: '8', refY: '3', orient: 'auto' });
            mk.appendChild(el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: 'rgba(0,0,0,0.6)' }));
            defs.appendChild(mk);
            const mk2 = el('marker', { id: 'arrowLight', markerWidth: '10', markerHeight: '10', refX: '8', refY: '3', orient: 'auto' });
            mk2.appendChild(el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: 'rgba(0,0,0,0.25)' }));
            defs.appendChild(mk2);
            svg.appendChild(defs);

            // Box helper
            function drawBox(id, x, y, w, h, title, subtitle = '', style = {}) {
                const g = el('g', { 'data-diagram-id': id });
                const rect = el('rect', {
                    x, y, width: w, height: h, rx: 12, ry: 12,
                    fill: style.fill || 'white',
                    stroke: style.stroke || 'rgba(0,0,0,0.35)',
                    'stroke-width': style.strokeWidth || '1.5'
                });
                g.appendChild(rect);

                const t = el('text', { x: x + 14, y: y + 22, 'font-size': '14', 'font-weight': '700', fill: 'rgba(0,0,0,0.86)' });
                t.textContent = title;
                g.appendChild(t);

                if (subtitle) {
                    const s = el('text', { x: x + 14, y: y + 44, 'font-size': '12', fill: 'rgba(0,0,0,0.55)' });
                    s.textContent = subtitle;
                    g.appendChild(s);
                }

                // interactions
                g.style.cursor = 'pointer';
                g.addEventListener('mouseenter', () => {
                    rect.setAttribute('stroke', 'rgba(52,152,219,0.95)');
                    rect.setAttribute('stroke-width', '2.4');
                });
                g.addEventListener('mouseleave', () => {
                    rect.setAttribute('stroke', style.stroke || 'rgba(0,0,0,0.35)');
                    rect.setAttribute('stroke-width', style.strokeWidth || '1.5');
                });

                g.addEventListener('click', () => {
                    // if it's a class, show its schema details
                    if (classes[title]) {
                        const c = classes[title];
                        setDetails(title,
                            ['Class'],
                            {
                                label: c.label || '-',
                                instances: (c.instances_count !== undefined ? c.instances_count : 0),
                                comment: c.comment || '-'
                            },
                            'subClassOf',
                            (c.subClassOf || []).length ? c.subClassOf : ['(none)']
                        );
                    } else {
                        setDetails(title, ['Box'], {}, '', []);
                    }
                });

                svg.appendChild(g);
                return { g, x, y, w, h };
            }

            function drawArrow(x1, y1, x2, y2, label, dashed = false, light = false, showLabel = true) {
                const path = el('path', {
                    d: `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`,
                    fill: 'none',
                    stroke: light ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.50)',
                    'stroke-width': light ? '2' : '2.5',
                    'marker-end': light ? 'url(#arrowLight)' : 'url(#arrow)',
                    'data-arrow': 'true'
                });
                if (dashed) path.setAttribute('stroke-dasharray', '8 8');
                svg.appendChild(path);

                // Show label with background for better visibility
                if (showLabel) {
                    const tx = (x1 + x2) / 2;
                    const ty = (y1 + y2) / 2;

                    // Add white background rectangle for label
                    const bbox = { x: tx - 60, y: ty - 12, width: 120, height: 20 };
                    const bg = el('rect', {
                        x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
                        fill: 'white', stroke: 'rgba(0,0,0,0.2)', 'stroke-width': '1',
                        rx: 4, ry: 4,
                        'data-arrow-bg': 'true'
                    });
                    svg.appendChild(bg);

                    const t = el('text', {
                        x: tx, y: ty + 5,
                        'font-size': '13',
                        'font-weight': '600',
                        fill: light ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.75)',
                        'text-anchor': 'middle',
                        'data-arrow-label': 'true'
                    });
                    t.textContent = label;
                    svg.appendChild(t);

                    // click label => property details
                    t.style.cursor = 'pointer';
                    t.addEventListener('click', () => {
                        const p = props[label];
                        if (!p) return;
                        setDetails(label,
                            [p.type],
                            {
                                label: p.label || '-',
                                domain: (p.domain || []).join(', ') || '-',
                                range: (p.range || []).join(', ') || '-'
                            },
                            '',
                            []
                        );
                    });
                }
            }

            // --- Draw featured boxes ---
            const boxResidential = drawBox(clsResidential, 560, 400, 300, 80, clsResidential, 'datatypeProperties → indicators', { fill: 'rgba(52, 152, 219, 0.1)' });

            // Left typology list - more compact
            const leftX = 60;
            const startY = 180;
            const stepY = 64;
            const typBoxes = [];
            typologySubs.slice(0, 12).forEach((name, i) => {
                typBoxes.push(drawBox(name, leftX, startY + i * stepY, 340, 52, name, 'subClassOf', { fill: 'white' }));
            });

            // If too many typologies, add a note box
            if (typologySubs.length > 12) {
                drawBox('MoreTypologies', leftX, startY + 12 * stepY, 340, 52, `+${typologySubs.length - 12} more typologies`, '', { fill: 'white' });
            }

            // Top relation/facility boxes - better spacing
            const topY = 60;
            const bPFR = clsPFR ? drawBox(clsPFR, 520, topY, 340, 60, clsPFR, 'relation entity', { fill: 'white' }) : null;
            const bPublic = clsPublicFacility ? drawBox(clsPublicFacility, 920, topY, 300, 60, clsPublicFacility, '', { fill: 'white' }) : null;
            const bSocial = clsSocialFacility ? drawBox(clsSocialFacility, 920, topY + 75, 300, 60, clsSocialFacility, '', { fill: 'white' }) : null;
            const bChild = clsChildCare ? drawBox(clsChildCare, 920, topY + 150, 300, 60, clsChildCare, '', { fill: 'white' }) : null;

            // Right indicators table box - LARGER to show ALL properties
            const allPropsCount = parcelDataProps.length;
            const boxHeight = Math.max(620, 100 + allPropsCount * 18 + 50);
            const indBox = drawBox('ParcelIndicators', 1060, 320, 700, boxHeight, 'Parcel indicators (xsd:float)', `domain: ${clsResidential} | Total: ${allPropsCount} properties`, { fill: 'white' });

            // Render indicator list inside the indicators box - SHOW ALL
            const listG = el('g');
            const listX = 1080;
            let listY = 370;
            const shown = parcelDataProps; // Show ALL properties, not limited

            const head = el('text', { x: listX, y: listY, 'font-size': '12', 'font-weight': '700', fill: 'rgba(0,0,0,0.75)' });
            head.textContent = 'datatypeProperties';
            listG.appendChild(head);
            listY += 22;

            shown.forEach(pn => {
                const t = el('text', { x: listX, y: listY, 'font-size': '12', fill: 'rgba(0,0,0,0.75)' });
                t.textContent = pn;
                t.style.cursor = 'pointer';
                t.addEventListener('click', () => {
                    const p = props[pn];
                    setDetails(pn,
                        [p.type],
                        {
                            label: p.label || '-',
                            domain: (p.domain || []).join(', ') || '-',
                            range: (p.range || []).join(', ') || '-'
                        },
                        '',
                        []
                    );
                });
                listG.appendChild(t);
                listY += 18;
            });

            // No need for "more" text since we show all properties now

            svg.appendChild(listG);

            // PFR datatype props box (if exists)
            let bPFRProps = null;
            if (clsPFR && diagramFilters.dataProps) {
                bPFRProps = drawBox('PFRProps', 520, 150, 320, 140, 'ParcelFacilityRelation props', `domain: ${clsPFR}`, { fill: 'white' });
                const pg = el('g');
                let py = 190;
                pfrDataProps.slice(0, 5).forEach(pn => {
                    const t = el('text', { x: 540, y: py, 'font-size': '12', fill: 'rgba(0,0,0,0.75)' });
                    t.textContent = pn;
                    t.style.cursor = 'pointer';
                    t.addEventListener('click', () => {
                        const p = props[pn];
                        setDetails(pn,
                            [p.type],
                            {
                                label: p.label || '-',
                                domain: (p.domain || []).join(', ') || '-',
                                range: (p.range || []).join(', ') || '-'
                            },
                            '',
                            []
                        );
                    });
                    pg.appendChild(t);
                    py += 18;
                });
                svg.appendChild(pg);
            }

            // --- Draw edges according to filters ---
            if (diagramFilters.subClass) {
                typBoxes.forEach(tb => {
                    drawArrow(tb.x + tb.w, tb.y + tb.h / 2, boxResidential.x, boxResidential.y + boxResidential.h / 2, 'subClassOf', true, true);
                });
            }

            if (diagramFilters.dataProps) {
                // ResidentialParcel -> indicators box
                drawArrow(boxResidential.x + boxResidential.w, boxResidential.y + boxResidential.h / 2, indBox.x, indBox.y + 40, 'datatypeProperties', false, true);
                if (bPFR && bPFRProps) {
                    drawArrow(bPFR.x + bPFR.w / 2, bPFR.y + bPFR.h, bPFRProps.x + bPFRProps.w / 2, bPFRProps.y, 'datatypeProperties', false, true);
                }
            }

            if (diagramFilters.objProps) {
                // Draw object properties only when they connect featured classes
                objEdges.forEach(({ name, p }) => {
                    const d = (p.domain && p.domain.length ? p.domain[0] : null);
                    const r = (p.range && p.range.length ? p.range[0] : null);
                    if (!d || !r) return;

                    const featured = [clsResidential, clsPFR, clsPublicFacility, clsSocialFacility, clsChildCare].filter(Boolean);
                    const dOk = featured.some(f => sameName(d, f));
                    const rOk = featured.some(f => sameName(r, f));
                    if (!dOk || !rOk) return;

                    // Map to box centers
                    function boxCenter(cn) {
                        if (sameName(cn, clsResidential)) return { x: boxResidential.x + boxResidential.w, y: boxResidential.y + boxResidential.h / 2 };
                        if (clsPFR && bPFR && sameName(cn, clsPFR)) return { x: bPFR.x + bPFR.w, y: bPFR.y + bPFR.h / 2 };
                        if (clsPublicFacility && bPublic && sameName(cn, clsPublicFacility)) return { x: bPublic.x, y: bPublic.y + bPublic.h / 2 };
                        if (clsSocialFacility && bSocial && sameName(cn, clsSocialFacility)) return { x: bSocial.x, y: bSocial.y + bSocial.h / 2 };
                        if (clsChildCare && bChild && sameName(cn, clsChildCare)) return { x: bChild.x, y: bChild.y + bChild.h / 2 };
                        return null;
                    }

                    const s = boxCenter(d);
                    const t = boxCenter(r);
                    if (!s || !t) return;

                    drawArrow(s.x, s.y, t.x, t.y, name, false, false);
                });
            }

            // Bind pan/zoom for summary diagram mode
            bindPanZoom(svg);

            // default details
            setDetails('Ontology Diagram', ['Interactive'], {
                hint: 'Use mouse wheel to zoom; drag to pan.',
                filters: `subClassOf=${diagramFilters.subClass}, objectProps=${diagramFilters.objProps}, datatypeProps=${diagramFilters.dataProps}`
            }, '', []);

            DIAGRAM_RENDERED = true;
        }

        function resetDiagram() {
            // If diagram_data.json provides a viewBox, use it; otherwise fall back.
            const dd = DIAGRAM_DATA || window.DIAGRAM_DATA;
            const vb = (dd && dd.layout && dd.layout.viewBox) ? dd.layout.viewBox : null;
            diagramViewBox = vb ? { x: vb.x, y: vb.y, w: vb.w, h: vb.h } : { x: 0, y: 0, w: 1600, h: 900 };
            renderOntologyDiagram();
        }

        function highlightDiagram(query) {
            const svg = document.getElementById('ontology-diagram');
            if (!svg) return;
            const q = (query || '').toLowerCase();

            const groups = svg.querySelectorAll('g[data-diagram-id]');
            groups.forEach(g => {
                const id = (g.getAttribute('data-diagram-id') || '').toLowerCase();
                const rect = g.querySelector('rect');
                if (!rect) return;

                if (!q) {
                    rect.setAttribute('opacity', '1');
                    return;
                }

                if (id.includes(q)) {
                    rect.setAttribute('opacity', '1');
                } else {
                    rect.setAttribute('opacity', '0.22');
                }
            });
        }

        function downloadDiagram() {
            const svg = document.getElementById('ontology-diagram');
            if (!svg) return;

            // Serialize SVG
            const serializer = new XMLSerializer();
            let source = serializer.serializeToString(svg);

            // Ensure namespace
            if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }

            const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'ontology_diagram.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
        }

        function zoomIn() {
            const svg = document.getElementById('ontology-diagram');
            if (!svg) return;
            const scale = 0.8; // Zoom in by 20%
            diagramViewBox.w *= scale;
            diagramViewBox.h *= scale;
            svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);
        }

        function zoomOut() {
            const svg = document.getElementById('ontology-diagram');
            if (!svg) return;
            const scale = 1.25; // Zoom out by 25%
            diagramViewBox.w *= scale;
            diagramViewBox.h *= scale;
            svg.setAttribute('viewBox', `${diagramViewBox.x} ${diagramViewBox.y} ${diagramViewBox.w} ${diagramViewBox.h}`);
        }
        
        
        let queryData = null;
        let QUERY_DATA = null;
        
        function parseAndExecuteQuery(query) {
            const lowerQuery = query.toLowerCase();
            
            // Query Type 1: Isolation/Distance queries
            if (lowerQuery.includes('distance') && (lowerQuery.includes('>') || lowerQuery.includes('greater'))) {
                return executeIsolationQuery(query);
            }
            
            // Query Type 2: Community detection
            if (lowerQuery.includes('communities') || lowerQuery.includes('community')) {
                return executeCommunityQuery(query);
            }
            
            // Query Type 3: Diagnostic/Why queries
            if (lowerQuery.includes('why') || lowerQuery.includes('diagnostic')) {
                return executeDiagnosticQuery(query);
            }
            
            // Query Type 4: Dimension score queries
            if (lowerQuery.includes('score') || lowerQuery.includes('mobility') || 
                lowerQuery.includes('ecological') || lowerQuery.includes('social')) {
                return executeDimensionQuery(query);
            }
            
            // Query Type 5: General parcel type queries
            if (lowerQuery.includes('find') || lowerQuery.includes('show')) {
                return executeGeneralQuery(query);
            }
            
            throw new Error('Query pattern not recognized. Please try one of the example queries.');
        }
        
        function executeIsolationQuery(query) {
            // Extract parcel type
            let parcelType = 'DevelopmentPriorityParcel';
            if (query.includes('TransitOriented')) parcelType = 'TransitOrientedParcel';
            if (query.includes('EcologicalChampion')) parcelType = 'EcologicalChampionParcel';
            if (query.includes('SocialChampion')) parcelType = 'SocialChampionParcel';
            if (query.includes('BalancedRegenerative')) parcelType = 'BalancedRegenerativeParcel';
            
            // Extract threshold
            const match = query.match(/(\d+)\s*meters?/i);
            const threshold = match ? parseFloat(match[1]) : 450;
            
            // Find matching parcels
            const matchingParcels = queryData.parcels.filter(p => p.type === parcelType);
            
            // For each, find nearest neighbor distance
            const results = [];
            matchingParcels.forEach(parcel => {
                const proximityRelations = queryData.proximity.filter(
                    rel => rel.parcel1 === parcel.label || rel.parcel2 === parcel.label
                );
                
                if (proximityRelations.length > 0) {
                    const distances = proximityRelations.map(rel => rel.distance);
                    const minDistance = Math.min(...distances);
                    
                    if (minDistance > threshold) {
                        results.push({
                            parcel: parcel,
                            nearestDistance: minDistance,
                            totalProximityRelations: proximityRelations.length
                        });
                    }
                }
            });
            
            return {
                type: 'isolation',
                interpretation: `Finding ${parcelType} parcels where the nearest neighbor distance exceeds ${threshold} meters`,
                results: results.sort((a, b) => b.nearestDistance - a.nearestDistance),
                query: query
            };
        }
        
        function executeCommunityQuery(query) {
            // Extract parcel type
            let targetType = 'EcologicalChampionParcel';
            if (query.includes('TransitOriented')) targetType = 'TransitOrientedParcel';
            if (query.includes('DevelopmentPriority')) targetType = 'DevelopmentPriorityParcel';
            if (query.includes('SocialChampion')) targetType = 'SocialChampionParcel';
            
            // Extract percentage threshold
            const match = query.match(/(\d+)%/);
            const threshold = match ? parseFloat(match[1]) / 100 : 0.8;
            
            // Build neighbor map
            const neighborMap = {};
            queryData.neighbors.forEach(rel => {
                if (!neighborMap[rel.from]) neighborMap[rel.from] = [];
                neighborMap[rel.from].push(rel.to);
            });
            
            // Find parcels matching criteria
            const results = [];
            queryData.parcels.forEach(parcel => {
                const neighbors = neighborMap[parcel.label] || [];
                if (neighbors.length < 3) return; // Need at least 3 neighbors
                
                // Count neighbors of target type
                let targetCount = 0;
                neighbors.forEach(neighborId => {
                    const neighbor = queryData.parcels.find(p => p.label === neighborId);
                    if (neighbor && neighbor.type === targetType) {
                        targetCount++;
                    }
                });
                
                const percentage = targetCount / neighbors.length;
                
                if (percentage > threshold) {
                    results.push({
                        parcel: parcel,
                        totalNeighbors: neighbors.length,
                        targetTypeNeighbors: targetCount,
                        percentage: (percentage * 100).toFixed(1)
                    });
                }
            });
            
            return {
                type: 'community',
                interpretation: `Finding parcels where more than ${(threshold*100).toFixed(0)}% of neighbors are ${targetType}`,
                results: results.sort((a, b) => b.percentage - a.percentage),
                query: query
            };
        }
        
        function executeDiagnosticQuery(query) {
            // Extract parcel ID
            const match = query.match(/kml_\d+/i);
            if (!match) {
                throw new Error('Please specify a parcel ID (e.g., kml_106173)');
            }
            
            const parcelId = match[0];
            const parcel = queryData.parcels.find(p => p.label === parcelId);
            
            if (!parcel) {
                throw new Error(`Parcel ${parcelId} not found`);
            }
            
            // Analyze why it has certain classification
            const rci = parcel.RCI_score || 0;
            const ecological = parcel.DimensionScore_Ecological || 0;
            const social = parcel.DimensionScore_Social || 0;
            const mobility = parcel.DimensionScore_Mobility || 0;
            const density = parcel.DimensionScore_Density || 0;
            
            const diagnostic = {
                parcel: parcel,
                rci: rci,
                dimensions: {
                    ecological: ecological,
                    social: social,
                    mobility: mobility,
                    density: density
                },
                reasoning: []
            };
            
            // Determine classification reasoning
            if (rci < 0.5) {
                diagnostic.reasoning.push(`RCI Score = ${rci.toFixed(3)} < 0.5 → Classified as DevelopmentPriorityParcel`);
                diagnostic.reasoning.push(`Needs regenerative investment due to low overall capacity`);
            }
            
            if (ecological < 0.5) {
                diagnostic.reasoning.push(`Low Ecological Score (${ecological.toFixed(3)}) indicates limited green space and biodiversity access`);
            }
            
            if (social < 0.5) {
                diagnostic.reasoning.push(`Low Social Score (${social.toFixed(3)}) indicates limited access to community facilities`);
            }
            
            if (mobility < 0.5) {
                diagnostic.reasoning.push(`Low Mobility Score (${mobility.toFixed(3)}) indicates poor transportation connectivity`);
            }
            
            // Find weakest dimension
            const dims = [
                { name: 'Ecological', score: ecological },
                { name: 'Social', score: social },
                { name: 'Mobility', score: mobility },
                { name: 'Density', score: density }
            ];
            const weakest = dims.reduce((min, d) => d.score < min.score ? d : min);
            
            diagnostic.reasoning.push(`Weakest dimension: ${weakest.name} (${weakest.score.toFixed(3)})`);
            diagnostic.reasoning.push(`Priority: Improve ${weakest.name.toLowerCase()} infrastructure and accessibility`);
            
            return {
                type: 'diagnostic',
                interpretation: `Diagnostic analysis for parcel ${parcelId} showing causal chain of classification`,
                results: [diagnostic],
                query: query
            };
        }
        
        function executeDimensionQuery(query) {
            const lowerQuery = query.toLowerCase();
            
            // Extract parcel type
            let parcelType = null;
            if (query.includes('TransitOriented')) parcelType = 'TransitOrientedParcel';
            if (query.includes('EcologicalChampion')) parcelType = 'EcologicalChampionParcel';
            if (query.includes('SocialChampion')) parcelType = 'SocialChampionParcel';
            if (query.includes('BalancedRegenerative')) parcelType = 'BalancedRegenerativeParcel';
            if (query.includes('DevelopmentPriority')) parcelType = 'DevelopmentPriorityParcel';
            
            // Extract dimension
            let dimension = null;
            if (lowerQuery.includes('mobility')) dimension = 'DimensionScore_Mobility';
            if (lowerQuery.includes('ecological')) dimension = 'DimensionScore_Ecological';
            if (lowerQuery.includes('social')) dimension = 'DimensionScore_Social';
            if (lowerQuery.includes('density')) dimension = 'DimensionScore_Density';
            
            // Extract threshold
            const match = query.match(/>\s*([\d.]+)/);
            const threshold = match ? parseFloat(match[1]) : 0.8;
            
            // Filter parcels
            let results = queryData.parcels;
            
            if (parcelType) {
                results = results.filter(p => p.type === parcelType);
            }
            
            if (dimension) {
                results = results.filter(p => (p[dimension] || 0) > threshold);
            } else if (lowerQuery.includes('all dimension')) {
                results = results.filter(p => 
                    (p.DimensionScore_Ecological || 0) > threshold &&
                    (p.DimensionScore_Social || 0) > threshold &&
                    (p.DimensionScore_Mobility || 0) > threshold &&
                    (p.DimensionScore_Density || 0) > threshold
                );
            }
            
            return {
                type: 'dimension',
                interpretation: `Finding ${parcelType || 'all parcels'} with ${dimension ? dimension.replace('DimensionScore_', '') + ' score' : 'all dimension scores'} > ${threshold}`,
                results: results.map(p => ({
                    parcel: p,
                    ecological: p.DimensionScore_Ecological,
                    social: p.DimensionScore_Social,
                    mobility: p.DimensionScore_Mobility,
                    density: p.DimensionScore_Density,
                    rci: p.RCI_score
                })).sort((a, b) => (b.rci || 0) - (a.rci || 0)),
                query: query
            };
        }
        
        function executeGeneralQuery(query) {
            // Simple parcel type filter
            let parcelType = null;
            if (query.includes('TransitOriented')) parcelType = 'TransitOrientedParcel';
            if (query.includes('EcologicalChampion')) parcelType = 'EcologicalChampionParcel';
            if (query.includes('SocialChampion')) parcelType = 'SocialChampionParcel';
            if (query.includes('BalancedRegenerative')) parcelType = 'BalancedRegenerativeParcel';
            if (query.includes('DevelopmentPriority')) parcelType = 'DevelopmentPriorityParcel';
            
            let results = queryData.parcels;
            
            if (parcelType) {
                results = results.filter(p => p.type === parcelType);
            }
            
            return {
                type: 'general',
                interpretation: `Showing all ${parcelType || 'parcels'}`,
                results: results.slice(0, 50).map(p => ({ parcel: p })),
                query: query
            };
        }
        
        function displayResults(results) {
            const interpretationDiv = document.getElementById('queryInterpretation');
            const contentDiv = document.getElementById('resultsContent');
            const countSpan = document.getElementById('resultsCount');

            // Show interpretation
            interpretationDiv.innerHTML = `
                <div class="query-interpretation">
                    <h4>Query Interpretation</h4>
                    <p>${results.interpretation}</p>
                </div>
            `;

            // Update count
            countSpan.textContent = `${results.results.length} result${results.results.length !== 1 ? 's' : ''}`;

            // Display results based on type
            if (results.type === 'isolation') {
                displayIsolationResults(results.results, contentDiv);
            } else if (results.type === 'community') {
                displayCommunityResults(results.results, contentDiv);
            } else if (results.type === 'diagnostic') {
                displayDiagnosticResults(results.results, contentDiv);
            } else if (results.type === 'dimension') {
                displayDimensionResults(results.results, contentDiv);
            } else {
                displayGeneralResults(results.results, contentDiv);
            }

            // Extract parcel names and show on map
            const parcelNames = [];
            if (results.type === 'isolation' || results.type === 'dimension' || results.type === 'community') {
                // These all have result.parcel structure
                results.results.forEach(r => {
                    if (r.parcel && r.parcel.label) {
                        parcelNames.push(r.parcel.label);
                    }
                });
            } else if (results.type === 'diagnostic') {
                results.results.forEach(r => {
                    if (r.parcelId) {
                        parcelNames.push(r.parcelId);
                    }
                });
            }

            // Show map with highlighted parcels
            if (parcelNames.length > 0) {
                showMapWithParcels(parcelNames);
            }
        }
        
        function displayIsolationResults(results, container) {
            let html = '<div class="results-grid">';
            
            results.slice(0, 20).forEach(result => {
                const p = result.parcel;
                html += `
                    <div class="result-card">
                        <h3>${p.label}</h3>
                        <div class="result-property">
                            <span class="result-label">Type</span>
                            <span class="result-value">${p.type}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Nearest Neighbor Distance</span>
                            <span class="result-value highlight">${result.nearestDistance.toFixed(1)} m</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">RCI Score</span>
                            <span class="result-value">${(p.RCI_score || 0).toFixed(3)}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Proximity Relations</span>
                            <span class="result-value">${result.totalProximityRelations}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            if (results.length > 20) {
                html += `<p style="text-align: center; margin-top: 20px; color: #7f8c8d;">Showing top 20 of ${results.length} results</p>`;
            }
            
            container.innerHTML = html;
        }
        
        function displayCommunityResults(results, container) {
            let html = '<div class="results-grid">';
            
            results.slice(0, 20).forEach(result => {
                const p = result.parcel;
                html += `
                    <div class="result-card">
                        <h3>${p.label}</h3>
                        <div class="result-property">
                            <span class="result-label">Type</span>
                            <span class="result-value">${p.type}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Target Type Percentage</span>
                            <span class="result-value highlight">${result.percentage}%</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Target Type Neighbors</span>
                            <span class="result-value">${result.targetTypeNeighbors} / ${result.totalNeighbors}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">RCI Score</span>
                            <span class="result-value">${(p.RCI_score || 0).toFixed(3)}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            if (results.length > 20) {
                html += `<p style="text-align: center; margin-top: 20px; color: #7f8c8d;">Showing top 20 of ${results.length} results</p>`;
            }
            
            container.innerHTML = html;
        }
        
        function displayDiagnosticResults(results, container) {
            const result = results[0];
            const p = result.parcel;
            
            let html = `
                <div class="result-card" style="max-width: 800px; margin: 0 auto;">
                    <h3>${p.label} - Diagnostic Analysis</h3>
                    
                    <div class="result-property">
                        <span class="result-label">Classification</span>
                        <span class="result-value">${p.type}</span>
                    </div>
                    
                    <div class="result-property">
                        <span class="result-label">RCI Score</span>
                        <span class="result-value highlight">${result.rci.toFixed(3)}</span>
                    </div>
                    
                    <h4 style="margin-top: 20px; margin-bottom: 10px; color: #34495e;">Dimension Scores</h4>
                    
                    <div class="result-property">
                        <span class="result-label">Ecological</span>
                        <span class="result-value">${result.dimensions.ecological.toFixed(3)}</span>
                    </div>
                    
                    <div class="result-property">
                        <span class="result-label">Social</span>
                        <span class="result-value">${result.dimensions.social.toFixed(3)}</span>
                    </div>
                    
                    <div class="result-property">
                        <span class="result-label">Mobility</span>
                        <span class="result-value">${result.dimensions.mobility.toFixed(3)}</span>
                    </div>
                    
                    <div class="result-property">
                        <span class="result-label">Density</span>
                        <span class="result-value">${result.dimensions.density.toFixed(3)}</span>
                    </div>
                    
                    <div class="diagnostic-section">
                        <div class="diagnostic-title">Causal Chain Analysis</div>
                        ${result.reasoning.map(r => `<div class="diagnostic-item">• ${r}</div>`).join('')}
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        }
        
        function displayDimensionResults(results, container) {
            let html = '<div class="results-grid">';
            
            results.slice(0, 20).forEach(result => {
                const p = result.parcel;
                html += `
                    <div class="result-card">
                        <h3>${p.label}</h3>
                        <div class="result-property">
                            <span class="result-label">Type</span>
                            <span class="result-value">${p.type}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">RCI Score</span>
                            <span class="result-value highlight">${(result.rci || 0).toFixed(3)}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Ecological</span>
                            <span class="result-value">${(result.ecological || 0).toFixed(3)}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Social</span>
                            <span class="result-value">${(result.social || 0).toFixed(3)}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Mobility</span>
                            <span class="result-value">${(result.mobility || 0).toFixed(3)}</span>
                        </div>
                        <div class="result-property">
                            <span class="result-label">Density</span>
                            <span class="result-value">${(result.density || 0).toFixed(3)}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            if (results.length > 20) {
                html += `<p style="text-align: center; margin-top: 20px; color: #7f8c8d;">Showing top 20 of ${results.length} results</p>`;
            }
            
            container.innerHTML = html;
        }
        
        function displayGeneralResults(results, container) {
            displayDimensionResults(results, container);
        }
        
        function displayError(message) {
            const interpretationDiv = document.getElementById('queryInterpretation');
            const contentDiv = document.getElementById('resultsContent');
            const countSpan = document.getElementById('resultsCount');
        
            if (countSpan) countSpan.textContent = 'Error';
        
            if (interpretationDiv) {
                interpretationDiv.innerHTML = `
                    <div class="query-interpretation">
                        <h3>⚠️ Error</h3>
                        <p>${message || 'Unknown error'}</p>
                    </div>
                `;
            }
        
            if (contentDiv) {
                contentDiv.innerHTML = `
                    <div class="no-results">
                        <p>${message || 'Unknown error'}</p>
                    </div>
                `;
            }
        }
        
        
        function loadExample(queryText) {
            document.getElementById('queryInput').value = queryText;
            executeQuery();
        }
        
        function executeQuery() {
            const query = document.getElementById('queryInput').value.trim();

            if (!query) {
                alert('Please enter a query');
                return;
            }

            const resultsSection = document.getElementById('resultsSection');
            resultsSection.classList.add('show');

            try {
                const results = parseAndExecuteQuery(query);
                displayResults(results);
            } catch (error) {
                displayError(error.message);
            }

            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }

        // =====================
        // MAP FUNCTIONALITY
        // =====================
        let parcelMap = null;
        let parcelsGeoJSON = null;
        let allParcelsLayer = null;
        let highlightedParcelsLayer = null;

        async function initializeMap() {
            try {
                // Initialize the map centered on Singapore with light mode tiles
                parcelMap = L.map('parcelMap', {
                    center: [1.35, 103.82],
                    zoom: 12,
                    zoomControl: true
                });

                // Add light mode tile layer (NOT dark mode)
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(parcelMap);

                // Load parcels GeoJSON
                const response = await fetch('parcels.geojson');
                parcelsGeoJSON = await response.json();

                // Create base parcels layer (light blue, semi-transparent)
                allParcelsLayer = L.geoJSON(parcelsGeoJSON, {
                    style: {
                        fillColor: '#3498db',
                        fillOpacity: 0.2,
                        color: '#3498db',
                        weight: 1,
                        opacity: 0.6
                    },
                    onEachFeature: function(feature, layer) {
                        const parcelName = feature.properties.Name || 'Unknown';
                        layer.bindPopup(`
                            <div class="popup-title">Parcel: ${parcelName}</div>
                            <div class="popup-row">
                                <span class="popup-label">Status:</span>
                                <span class="popup-value">Base parcel</span>
                            </div>
                        `);
                    }
                }).addTo(parcelMap);

                console.log('Map initialized with', parcelsGeoJSON.features.length, 'parcels');
            } catch (error) {
                console.error('Error initializing map:', error);
            }
        }

        function showMapWithParcels(parcelNames) {
            const mapSection = document.getElementById('mapSection');
            mapSection.style.display = 'block';

            // Initialize map if not already done
            if (!parcelMap) {
                initializeMap().then(() => {
                    highlightParcelsOnMap(parcelNames);
                });
            } else {
                highlightParcelsOnMap(parcelNames);
            }

            // Scroll to map
            setTimeout(() => {
                mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }

        function highlightParcelsOnMap(parcelNames) {
            if (!parcelsGeoJSON || !parcelMap) return;

            // Remove previous highlighted layer
            if (highlightedParcelsLayer) {
                parcelMap.removeLayer(highlightedParcelsLayer);
            }

            // Filter features that match the parcel names
            const highlightedFeatures = parcelsGeoJSON.features.filter(f => 
                parcelNames.includes(f.properties.Name)
            );

            if (highlightedFeatures.length === 0) {
                console.warn('No matching parcels found for highlighting');
                return;
            }

            // Create highlighted parcels layer (red, more opaque)
            highlightedParcelsLayer = L.geoJSON({
                type: 'FeatureCollection',
                features: highlightedFeatures
            }, {
                style: {
                    fillColor: '#e74c3c',
                    fillOpacity: 0.6,
                    color: '#e74c3c',
                    weight: 2,
                    opacity: 1
                },
                onEachFeature: function(feature, layer) {
                    const parcelName = feature.properties.Name || 'Unknown';
                    
                    // Get additional info from queryData if available
                    let parcelInfo = null;
                    if (window.queryData && window.queryData.parcels) {
                        parcelInfo = window.queryData.parcels.find(p => p.label === parcelName);
                    }

                    let popupContent = `<div class="popup-title">📍 ${parcelName}</div>`;
                    
                    if (parcelInfo) {
                        popupContent += `
                            <div class="popup-row">
                                <span class="popup-label">Type:</span>
                                <span class="popup-value">${parcelInfo.type || '-'}</span>
                            </div>
                            <div class="popup-row">
                                <span class="popup-label">RCI Score:</span>
                                <span class="popup-value">${parcelInfo.RCI_score ? parcelInfo.RCI_score.toFixed(3) : '-'}</span>
                            </div>
                        `;
                        
                        if (parcelInfo.DimensionScore_Mobility !== undefined) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Mobility:</span>
                                    <span class="popup-value">${parcelInfo.DimensionScore_Mobility.toFixed(3)}</span>
                                </div>
                            `;
                        }
                        
                        if (parcelInfo.DimensionScore_Social !== undefined) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Social:</span>
                                    <span class="popup-value">${parcelInfo.DimensionScore_Social.toFixed(3)}</span>
                                </div>
                            `;
                        }
                        
                        if (parcelInfo.DimensionScore_Ecological !== undefined) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Ecological:</span>
                                    <span class="popup-value">${parcelInfo.DimensionScore_Ecological.toFixed(3)}</span>
                                </div>
                            `;
                        }
                    } else {
                        popupContent += `
                            <div class="popup-row">
                                <span class="popup-label">Status:</span>
                                <span class="popup-value">Query result</span>
                            </div>
                        `;
                    }

                    layer.bindPopup(popupContent);
                    
                    // Open popup on hover
                    layer.on('mouseover', function(e) {
                        this.openPopup();
                    });
                }
            }).addTo(parcelMap);

            // Fit map to highlighted parcels
            if (highlightedParcelsLayer.getBounds().isValid()) {
                parcelMap.fitBounds(highlightedParcelsLayer.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 14
                });
            }

            console.log('Highlighted', highlightedFeatures.length, 'parcels on map');
        }

        function clearMapHighlights() {
            if (highlightedParcelsLayer && parcelMap) {
                parcelMap.removeLayer(highlightedParcelsLayer);
                highlightedParcelsLayer = null;
                
                // Reset view to Singapore
                parcelMap.setView([1.35, 103.82], 12);
            }
        }

        function fitMapToParcels() {
            if (highlightedParcelsLayer && parcelMap && highlightedParcelsLayer.getBounds().isValid()) {
                parcelMap.fitBounds(highlightedParcelsLayer.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 14
                });
            } else if (allParcelsLayer && parcelMap && allParcelsLayer.getBounds().isValid()) {
                parcelMap.fitBounds(allParcelsLayer.getBounds(), {
                    padding: [50, 50]
                });
            }
        }

        // Make map functions globally accessible
        window.showMapWithParcels = showMapWithParcels;
        window.clearMapHighlights = clearMapHighlights;
        window.fitMapToParcels = fitMapToParcels;


        // =====================
        // NETWORK VIEW MINI-MAP
        // =====================
        let networkMiniMap = null;
        let networkParcelsGeoJSON = null;
        let networkAllParcelsLayer = null;
        let networkSelectedLayer = null;
        let networkConnectedLayer = null;

        async function initializeNetworkMiniMap() {
            console.log('[Network Map] initializeNetworkMiniMap called');
            if (networkMiniMap) {
                console.log('[Network Map] Map already initialized, skipping');
                return; // Already initialized
            }

            try {
                console.log('[Network Map] Creating Leaflet map instance...');
                // Initialize mini-map
                networkMiniMap = L.map('networkMiniMap', {
                    center: [1.35, 103.82],
                    zoom: 12,
                    zoomControl: false
                });

                // Add light mode tile layer
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(networkMiniMap);

                // Load parcels if not already loaded
                if (!networkParcelsGeoJSON) {
                    const response = await fetch('parcels.geojson');
                    networkParcelsGeoJSON = await response.json();
                }

                // Create base layer (all parcels, very light)
                networkAllParcelsLayer = L.geoJSON(networkParcelsGeoJSON, {
                    style: {
                        fillColor: '#95a5a6',
                        fillOpacity: 0.15,
                        color: '#95a5a6',
                        weight: 0.5,
                        opacity: 0.3
                    }
                }).addTo(networkMiniMap);

                console.log('Network mini-map initialized');
            } catch (error) {
                console.error('Error initializing network mini-map:', error);
            }
        }

        function showNetworkMiniMap(nodeId) {
            console.log('[Network Map] showNetworkMiniMap called with nodeId:', nodeId);
            const mapSection = document.getElementById('networkMapSection');
            if (!mapSection) {
                console.error('[Network Map] networkMapSection element not found!');
                return;
            }
            mapSection.style.display = 'block';
            console.log('[Network Map] Map section displayed');

            // Initialize map if needed
            if (!networkMiniMap) {
                console.log('[Network Map] Initializing map for first time...');
                initializeNetworkMiniMap().then(() => {
                    console.log('[Network Map] Map initialized, updating...');
                    updateNetworkMiniMap(nodeId);
                }).catch(err => {
                    console.error('[Network Map] Initialization error:', err);
                });
            } else {
                console.log('[Network Map] Map already initialized, updating...');
                updateNetworkMiniMap(nodeId);
            }
        }

        function updateNetworkMiniMap(nodeId) {
            console.log('[Network Map] updateNetworkMiniMap called with nodeId:', nodeId);
            if (!networkParcelsGeoJSON) {
                console.error('[Network Map] networkParcelsGeoJSON not loaded!');
                return;
            }
            if (!networkMiniMap) {
                console.error('[Network Map] networkMiniMap not initialized!');
                return;
            }

            // Extract local name from URI (e.g., "kml_84321" from full URI)
            function extractLocalName(id) {
                if (!id) return id;
                // If it's a full URI, extract the part after # or /
                if (id.includes('#')) {
                    return id.split('#').pop();
                } else if (id.includes('/')) {
                    return id.split('/').pop();
                }
                return id;
            }

            const localNodeId = extractLocalName(nodeId);
            console.log('[Network Map] Extracted local node ID:', localNodeId);

            // Remove previous highlighted layers
            if (networkSelectedLayer) {
                networkMiniMap.removeLayer(networkSelectedLayer);
            }
            if (networkConnectedLayer) {
                networkMiniMap.removeLayer(networkConnectedLayer);
            }

            // Find connected nodes
            const connectedNodeIds = [];
            allEdges.forEach(edge => {
                if (edge.from === nodeId) {
                    connectedNodeIds.push(edge.to);
                } else if (edge.to === nodeId) {
                    connectedNodeIds.push(edge.from);
                }
            });

            console.log(`[Network Map] Selected node: ${localNodeId}, Connected nodes: ${connectedNodeIds.length}`);

            // Extract local names from connected node IDs
            const connectedLocalIds = connectedNodeIds.map(id => extractLocalName(id));
            console.log('[Network Map] Connected local IDs:', connectedLocalIds.slice(0, 5));

            // Find features for connected nodes (purple)
            const connectedFeatures = networkParcelsGeoJSON.features.filter(f =>
                connectedLocalIds.includes(f.properties.Name)
            );

            console.log(`[Network Map] Found ${connectedFeatures.length} connected parcels in GeoJSON`);

            if (connectedFeatures.length > 0) {
                networkConnectedLayer = L.geoJSON({
                    type: 'FeatureCollection',
                    features: connectedFeatures
                }, {
                    style: {
                        fillColor: '#9b59b6',
                        fillOpacity: 0.5,
                        color: '#8e44ad',
                        weight: 2,
                        opacity: 0.8
                    },
                    onEachFeature: function(feature, layer) {
                        const parcelName = feature.properties.Name;
                        const node = allNodes.find(n => n.id === parcelName);
                        
                        let popupContent = `<div class="popup-title">🔗 Connected: ${parcelName}</div>`;
                        if (node) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Type:</span>
                                    <span class="popup-value">${node.type || '-'}</span>
                                </div>
                            `;
                            if (node.rci_score) {
                                popupContent += `
                                    <div class="popup-row">
                                        <span class="popup-label">RCI:</span>
                                        <span class="popup-value">${node.rci_score.toFixed(3)}</span>
                                    </div>
                                `;
                            }
                        }
                        layer.bindPopup(popupContent);
                    }
                }).addTo(networkMiniMap);
            }

            // Find feature for selected node (orange)
            const selectedFeature = networkParcelsGeoJSON.features.find(f =>
                f.properties.Name === localNodeId
            );

            console.log('[Network Map] Selected parcel found in GeoJSON:', selectedFeature ? 'YES' : 'NO');
            if (!selectedFeature) {
                console.warn('[Network Map] No parcel found for node:', nodeId, '(local:', localNodeId, ')');
            }

            if (selectedFeature) {
                networkSelectedLayer = L.geoJSON({
                    type: 'FeatureCollection',
                    features: [selectedFeature]
                }, {
                    style: {
                        fillColor: '#f39c12',
                        fillOpacity: 0.7,
                        color: '#e67e22',
                        weight: 3,
                        opacity: 1
                    },
                    onEachFeature: function(feature, layer) {
                        const node = allNodes.find(n => n.id === nodeId);

                        let popupContent = `<div class="popup-title">⭐ Selected: ${localNodeId}</div>`;
                        if (node) {
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Type:</span>
                                    <span class="popup-value">${node.type || '-'}</span>
                                </div>
                            `;
                            if (node.rci_score) {
                                popupContent += `
                                    <div class="popup-row">
                                        <span class="popup-label">RCI:</span>
                                        <span class="popup-value">${node.rci_score.toFixed(3)}</span>
                                    </div>
                                `;
                            }
                            if (node.properties) {
                                if (node.properties.DimensionScore_Mobility) {
                                    popupContent += `
                                        <div class="popup-row">
                                            <span class="popup-label">Mobility:</span>
                                            <span class="popup-value">${parseFloat(node.properties.DimensionScore_Mobility).toFixed(3)}</span>
                                        </div>
                                    `;
                                }
                                if (node.properties.DimensionScore_Social) {
                                    popupContent += `
                                        <div class="popup-row">
                                            <span class="popup-label">Social:</span>
                                            <span class="popup-value">${parseFloat(node.properties.DimensionScore_Social).toFixed(3)}</span>
                                        </div>
                                    `;
                                }
                                if (node.properties.DimensionScore_Ecological) {
                                    popupContent += `
                                        <div class="popup-row">
                                            <span class="popup-label">Ecological:</span>
                                            <span class="popup-value">${parseFloat(node.properties.DimensionScore_Ecological).toFixed(3)}</span>
                                        </div>
                                    `;
                                }
                            }
                            popupContent += `
                                <div class="popup-row">
                                    <span class="popup-label">Connections:</span>
                                    <span class="popup-value">${connectedNodeIds.length}</span>
                                </div>
                            `;
                        }
                        layer.bindPopup(popupContent);
                    }
                }).addTo(networkMiniMap);

                // Fit bounds to show selected and connected parcels
                fitNetworkMap();
            } else {
                console.warn(`No parcel found for node: ${nodeId}`);
            }
        }

        function fitNetworkMap() {
            console.log('[Network Map] fitNetworkMap called');
            console.log('[Network Map] networkMiniMap:', networkMiniMap ? 'initialized' : 'NOT initialized');
            console.log('[Network Map] networkSelectedLayer:', networkSelectedLayer ? 'exists' : 'null');
            console.log('[Network Map] networkConnectedLayer:', networkConnectedLayer ? 'exists' : 'null');

            if (!networkMiniMap) {
                console.warn('[Network Map] Cannot fit - map not initialized yet');
                alert('请先点击一个节点来初始化地图！\nPlease click a node first to initialize the map!');
                return;
            }

            const layers = [];
            if (networkSelectedLayer) layers.push(networkSelectedLayer);
            if (networkConnectedLayer) layers.push(networkConnectedLayer);

            console.log('[Network Map] Total layers to fit:', layers.length);

            if (layers.length > 0) {
                const group = L.featureGroup(layers);
                if (group.getBounds().isValid()) {
                    console.log('[Network Map] Fitting bounds...');
                    networkMiniMap.fitBounds(group.getBounds(), {
                        padding: [30, 30],
                        maxZoom: 14
                    });
                    console.log('[Network Map] Bounds fitted successfully');
                } else {
                    console.warn('[Network Map] Bounds not valid');
                }
            } else {
                console.warn('[Network Map] No layers to fit');
                alert('没有选中的 parcel！请先点击一个节点。\nNo selected parcel! Please click a node first.');
            }
        }

        function hideNetworkMiniMap() {
            const mapSection = document.getElementById('networkMapSection');
            mapSection.style.display = 'none';
        }

        // Make network map functions globally accessible
        window.showNetworkMiniMap = showNetworkMiniMap;
        window.hideNetworkMiniMap = hideNetworkMiniMap;
        window.fitNetworkMap = fitNetworkMap;
