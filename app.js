document.addEventListener('DOMContentLoaded', () => {
        
        // --- Service Worker Registration ---
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('SW registration successful:', reg.scope))
                    .catch(err => console.log('SW registration failed:', err));
            });
        }


        let deferredPrompt;
        const installButton = document.getElementById('install-pwa-btn');
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installButton.classList.remove('hidden');
        });

        installButton.addEventListener('click', async (e) => {
            e.preventDefault();
            installButton.classList.add('hidden');
            if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
            dropdownMenu.classList.add('hidden');
        });

        window.addEventListener('appinstalled', () => { deferredPrompt = null; });

        // --- Application Logic ---
        const STORAGE_KEY = 'censoQuixada2025_v2.1';
        let records = [];
        let onConfirmAction = null;

        const recordsListContainer = document.getElementById('records-list-container');
        const emptyState = document.getElementById('empty-state');
        const recordCounterBadge = document.getElementById('record-counter-badge');
        const modal = document.getElementById('form-modal');
        const form = document.getElementById('census-form');
        const modalTitle = document.getElementById('modal-title');
        const confirmDialog = document.getElementById('confirm-dialog');
        const confirmTitle = document.getElementById('confirm-title');
        const confirmMessage = document.getElementById('confirm-message');
        const aboutModal = document.getElementById('about-modal');
        const lgpdModal = document.getElementById('lgpd-modal');
        const dropdownMenu = document.getElementById('dropdown-menu');

        const normalizeText = (text) => {
            if (typeof text !== 'string') return text;
            return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };
        const loadRecords = () => { records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; };
        const saveRecords = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); };
        const formatDate = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        const renderRecords = () => {
            recordsListContainer.innerHTML = '';
            const hasRecords = records.length > 0;
            emptyState.classList.toggle('hidden', hasRecords);
            recordsListContainer.classList.toggle('hidden', !hasRecords);
            if (hasRecords) {
                [...records].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(record => {
                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-lg shadow-md p-4 mb-4 flex justify-between items-center';
                    card.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${record.nomeCompleto}</h3>
                            <p class="text-gray-600">${record.endereco || 'Endereço não informado'}</p>
                            <p class="text-sm text-gray-400 mt-1">Coleta: ${formatDate(record.date)}</p>
                        </div>
                        <div class="flex gap-2">
                            <button class="edit-btn p-3 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" data-id="${record.id}" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                            <button class="delete-btn p-3 bg-red-100 text-red-600 rounded-full hover:bg-red-200" data-id="${record.id}" title="Remover"><span class="material-symbols-outlined">delete</span></button>
                        </div>`;
                    recordsListContainer.appendChild(card);
                });
            }
            recordCounterBadge.textContent = records.length;
        };
        
        const openModal = (recordId = null) => {
            form.reset();
            document.querySelectorAll('.selectable-btn.active, .selectable-multi-btn.active').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('[id^="detalhes"], [id$="Outro"], [id$="Detalhes"]').forEach(el => el.classList.add('hidden'));
            if (recordId) {
                modalTitle.textContent = 'Editar Registro';
                form.elements['record-id'].value = recordId;
                const record = records.find(r => r.id == recordId);
                if (record) {
                    Object.keys(record).forEach(key => {
                        const element = form.elements[key];
                        if (element && (typeof element.value !== 'undefined' || element.type === 'checkbox')) {
                           if (element.type === 'hidden' && element.previousElementSibling?.classList.contains('selectable-buttons')) {
                                const valueToSet = record[key] === true ? 'Sim' : (record[key] === false ? 'Não' : '');
                                element.value = valueToSet;
                                element.previousElementSibling.querySelectorAll('.selectable-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === valueToSet));
                            } else if (element.type === 'checkbox') {
                                element.checked = record[key];
                            }
                            else { element.value = record[key]; }
                        }
                        const buttonGroup = document.querySelector(`.multi-selectable-buttons[data-group-name="${key}"]`);
                        const checkboxes = form.querySelectorAll(`input[name="${key}"]`);
                        if(buttonGroup && Array.isArray(record[key])) {
                            record[key].forEach(value => {
                                const btn = buttonGroup.querySelector(`[data-value="${normalizeText(value)}"]`);
                                if(btn) btn.click();
                            });
                        } else if (checkboxes.length > 0 && Array.isArray(record[key])) {
                             record[key].forEach(value => {
                                const chk = form.querySelector(`input[name="${key}"][value="${normalizeText(value)}"]`);
                                if(chk) { chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true })); }
                            });
                        }
                    });
                    form.querySelector('#posseTerra').dispatchEvent(new Event('change'));
                }
            } else {
                modalTitle.textContent = 'Adicionar Novo Registro';
                form.elements['record-id'].value = '';
            }
            modal.classList.remove('hidden');
        };
        
        const openConfirmDialog = (title, message, onConfirm) => {
            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            onConfirmAction = onConfirm;
            confirmDialog.classList.remove('hidden');
        };

        const closeModalUI = (modalElement) => modalElement.classList.add('hidden');

        const handleFormSubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const recordId = formData.get('record-id');
            let recordData = {
                id: recordId || Date.now().toString(),
                date: recordId ? records.find(r => r.id == recordId).date : new Date().toISOString()
            };
            for (let [key, value] of formData.entries()) {
                if (key === 'record-id') continue;
                const normalizedValue = normalizeText(value);
                if (recordData[key]) {
                    if (!Array.isArray(recordData[key])) recordData[key] = [recordData[key]];
                    recordData[key].push(normalizedValue);
                } else {
                    recordData[key] = normalizedValue;
                }
            }
            ['irrigadoMilho', 'irrigadoFeijao', 'irrigadoMandioca', 'energiaEletrica', 'possuiTrator', 'acessoCredito'].forEach(key => {
                const val = recordData[key];
                recordData[key] = val === 'Sim' ? true : (val === 'Nao' ? false : null);
            });
            document.querySelectorAll('.multi-selectable-buttons').forEach(group => {
                const groupName = group.dataset.groupName;
                recordData[groupName] = Array.from(group.querySelectorAll('.selectable-multi-btn.active')).map(btn => normalizeText(btn.dataset.value));
            });
            if (!recordData.atividadesAgricolas) recordData.atividadesAgricolas = [];
            recordData.lgpdConfirm = form.elements.lgpdConfirm.checked;
            if (recordId) {
                const index = records.findIndex(r => r.id == recordId);
                if (index !== -1) records[index] = { ...records[index], ...recordData };
            } else { records.push(recordData); }
            saveRecords();
            renderRecords();
            closeModalUI(modal);
        };

        const handleDeleteSingle = (recordId) => {
            openConfirmDialog('Confirmar Exclusão', 'Tem certeza que deseja apagar este registro? Esta ação não pode ser desfeita.', () => {
                records = records.filter(r => r.id != recordId);
                saveRecords();
                renderRecords();
                closeModalUI(confirmDialog);
            });
        };

        const handleDeleteAll = () => {
            openConfirmDialog('Remover todos', 'Tem certeza que deseja apagar TODOS os registros? Esta ação não pode ser desfeita.', () => {
                records = [];
                saveRecords();
                renderRecords();
                closeModalUI(confirmDialog);
            });
        };
        
        const triggerDownload = (blob, fileName) => {
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const handleExportCSV = async () => {
            if (records.length === 0) {
                alert('Não há registros para exportar.');
                return;
            }
            const sanitizeCell = (cell) => {
                if (cell === undefined || cell === null) return '';
                if (typeof cell === 'boolean') return cell ? 'True' : 'False';
                let cellStr = String(cell);
                if (cellStr.includes(',')) cellStr = `"${cellStr.replace(/"/g, '""')}"`;
                return cellStr;
            };
            const headers = [ 'id', 'date', 'nomeCompleto', 'cpf', 'telefone', 'endereco', 'latitude', 'longitude', 'areaTotal', 'areaProdutiva', 'posseTerra', 'posseTerraOutro', 'culturaMilho', 'areaMilho', 'irrigadoMilho', 'culturaFeijao', 'areaFeijao', 'irrigadoFeijao', 'culturaMandioca', 'areaMandioca', 'irrigadoMandioca', 'culturaHortalicas', 'especificarHortalicas', 'culturaFruticultura', 'especificarFruticultura', 'culturaOutro', 'especificarOutro', 'bovinos', 'caprinos', 'ovinos', 'suinos', 'outrasCriacoes', 'atividadeAgroindustria', 'atividadeTurismoRural', 'atividadeApicultura', 'atividadePiscicultura', 'outrasAtividadesDetalhes', 'fonteAguaPoco', 'fonteAguaAcude', 'fonteAguaCisterna', 'fonteAguaOutro', 'fonteAguaOutro', 'energiaEletrica', 'transporte', 'possuiTrator', 'outrosEquipamentos', 'trabalhadoresFamiliares', 'trabalhadoresTemporarios', 'trabalhadoresPermanentes', 'destinoConsumoProprio', 'destinoVendaLocal', 'destinoFeira', 'destinoCooperativa', 'destinoOutro', 'destinoProducaoOutro', 'acessoCredito', 'programaPNAE', 'programaPAA', 'programaPRONAF', 'programaOutro', 'programasGovernoOutro', 'desafioAgua', 'desafioInfraestrutura', 'desafioCredito', 'desafioMercado', 'desafioAssistenciaTecnica', 'desafioOutro', 'desafiosOutro', 'observacoes', 'lgpdConfirm' ];
            const csvRows = records.map(record => {
                const row = { id: record.id, date: record.date, nomeCompleto: record.nomeCompleto, cpf: record.cpf, telefone: record.telefone, endereco: record.endereco, latitude: record.latitude, longitude: record.longitude, areaTotal: record.areaTotal, areaProdutiva: record.areaProdutiva, posseTerra: record.posseTerra, posseTerraOutro: record.posseTerraOutro, culturaMilho: record.atividadesAgricolas?.includes('Milho'), areaMilho: record.areaMilho, irrigadoMilho: record.irrigadoMilho, culturaFeijao: record.atividadesAgricolas?.includes('Feijao'), areaFeijao: record.areaFeijao, irrigadoFeijao: record.irrigadoFeijao, culturaMandioca: record.atividadesAgricolas?.includes('Mandioca'), areaMandioca: record.areaMandioca, irrigadoMandioca: record.irrigadoMandioca, culturaHortalicas: record.atividadesAgricolas?.includes('Hortalicas'), especificarHortalicas: record.especificarHortalicas, culturaFruticultura: record.atividadesAgricolas?.includes('Fruticultura'), especificarFruticultura: record.especificarFruticultura, culturaOutro: record.atividadesAgricolas?.includes('Outro'), especificarOutro: record.especificarOutro, bovinos: record.bovinos, caprinos: record.caprinos, ovinos: record.ovinos, suinos: record.suinos, outrasCriacoes: record.outrasCriacoes, atividadeAgroindustria: record.outrasAtividades?.includes('Agroindustria'), atividadeTurismoRural: record.outrasAtividades?.includes('Turismo Rural'), atividadeApicultura: record.outrasAtividades?.includes('Apicultura'), atividadePiscicultura: record.outrasAtividades?.includes('Piscicultura'), outrasAtividadesDetalhes: record.outrasAtividadesDetalhes, fonteAguaPoco: record.fonteAgua?.includes('Poco'), fonteAguaAcude: record.fonteAgua?.includes('Acude'), fonteAguaCisterna: record.fonteAgua?.includes('Cisterna'), fonteAguaOutro: record.fonteAgua?.includes('Outro'), fonteAguaOutro: record.fonteAguaOutro, energiaEletrica: record.energiaEletrica, transporte: record.transporte, possuiTrator: record.possuiTrator, outrosEquipamentos: record.outrosEquipamentos, trabalhadoresFamiliares: record.trabalhadoresFamiliares, trabalhadoresTemporarios: record.trabalhadoresTemporarios, trabalhadoresPermanentes: record.trabalhadoresPermanentes, destinoConsumoProprio: record.destinoProducao?.includes('Consumo proprio'), destinoVendaLocal: record.destinoProducao?.includes('Venda local'), destinoFeira: record.destinoProducao?.includes('Feira'), destinoCooperativa: record.destinoProducao?.includes('Cooperativa'), destinoOutro: record.destinoProducao?.includes('Outro'), destinoProducaoOutro: record.destinoProducaoOutro, acessoCredito: record.acessoCredito, programaPNAE: record.programasGoverno?.includes('PNAE'), programaPAA: record.programasGoverno?.includes('PAA'), programaPRONAF: record.programasGoverno?.includes('PRONAF'), programaOutro: record.programasGoverno?.includes('Outro'), programasGovernoOutro: record.programasGovernoOutro, desafioAgua: record.desafios?.includes('Agua'), desafioInfraestrutura: record.desafios?.includes('Infraestrutura'), desafioCredito: record.desafios?.includes('Credito'), desafioMercado: record.desafios?.includes('Mercado'), desafioAssistenciaTecnica: record.desafios?.includes('Assistencia tecnica'), desafioOutro: record.desafios?.includes('Outro'), desafiosOutro: record.desafiosOutro, observacoes: record.observacoes, lgpdConfirm: record.lgpdConfirm };
                return headers.map(header => sanitizeCell(row[header])).join(',');
            });
            const csvContent = [headers.join(','), ...csvRows].join('\n');
            const fileName = `censo_agropecuario_${new Date().toISOString().split('T')[0]}.csv`;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            try {
                const file = new File([blob], fileName, { type: 'text/csv' });
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Dados do Censo Agropecuário', text: `Arquivo de dados do censo: ${fileName}` });
                } else { triggerDownload(blob, fileName); }
            } catch (error) {
                console.error('Erro ao compartilhar:', error);
                alert(`Ocorreu um erro ao tentar compartilhar. O download será iniciado como alternativa.`);
                triggerDownload(blob, fileName);
            }
        };
        
        const handleGetCoords = () => {
            if (!navigator.geolocation) { alert("Geolocalização não é suportada pelo seu navegador."); return; }
            const btn = document.getElementById('get-coords-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span> Obtendo...`;
            btn.disabled = true;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    form.latitude.value = pos.coords.latitude.toFixed(6);
                    form.longitude.value = pos.coords.longitude.toFixed(6);
                    btn.innerHTML = originalHTML; btn.disabled = false;
                },
                (err) => {
                    let message = "Ocorreu um erro ao obter a localização.";
                    if (err.code === 1) message = "Permissão de localização negada. Por favor, habilite a permissão nas configurações do seu navegador/celular.";
                    if (err.code === 2) message = "Não foi possível determinar a sua localização (sinal de GPS fraco).";
                    alert(message);
                    btn.innerHTML = originalHTML; btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };

        const applyMask = (e, maskFn) => { e.target.value = maskFn(e.target.value); };
        const cpfMask = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{2})$/, '$1-$2');
        const phoneMask = (v) => {
            v = v.replace(/\D/g, '').slice(0, 11);
            if (v.length > 10) return v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
            if (v.length > 5) return v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
            if (v.length > 2) return v.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
            return v.replace(/^(\d*)/, "($1");
        };

        const setupEventListeners = () => {
            document.getElementById('add-new-btn').addEventListener('click', () => openModal());
            document.getElementById('cancel-btn').addEventListener('click', () => closeModalUI(modal));
            document.getElementById('export-csv-btn').addEventListener('click', handleExportCSV);
            document.getElementById('get-coords-btn').addEventListener('click', handleGetCoords);
            form.addEventListener('submit', handleFormSubmit);
            document.getElementById('cpf').addEventListener('input', (e) => applyMask(e, cpfMask));
            document.getElementById('telefone').addEventListener('input', (e) => applyMask(e, phoneMask));
            document.getElementById('posseTerra').addEventListener('change', (e) => {
                document.getElementById('posseTerraOutro').classList.toggle('hidden', e.target.value !== 'Outro');
            });
            recordsListContainer.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                const deleteBtn = e.target.closest('.delete-btn');
                if (editBtn) openModal(editBtn.dataset.id);
                if (deleteBtn) handleDeleteSingle(deleteBtn.dataset.id);
            });
            document.getElementById('record-counter-btn').addEventListener('click', () => dropdownMenu.classList.toggle('hidden'));
            document.getElementById('delete-all-btn').addEventListener('click', (e) => { e.preventDefault(); handleDeleteAll(); dropdownMenu.classList.add('hidden'); });
            document.getElementById('about-btn').addEventListener('click', (e) => { e.preventDefault(); aboutModal.classList.remove('hidden'); dropdownMenu.classList.add('hidden'); });
            document.getElementById('close-about-btn').addEventListener('click', () => closeModalUI(aboutModal));
            window.addEventListener('click', (e) => { if (!document.getElementById('menu-wrapper').contains(e.target)) dropdownMenu.classList.add('hidden'); });
            document.getElementById('lgpd-info-btn').addEventListener('click', () => lgpdModal.classList.remove('hidden'));
            document.getElementById('close-lgpd-btn').addEventListener('click', () => closeModalUI(lgpdModal));
            document.getElementById('confirm-cancel-btn').addEventListener('click', () => closeModalUI(confirmDialog));
            document.getElementById('confirm-action-btn').addEventListener('click', () => { if (onConfirmAction) onConfirmAction(); });
            form.addEventListener('click', (e) => {
                const singleBtn = e.target.closest('.selectable-btn');
                if (singleBtn) {
                    const group = singleBtn.parentElement;
                    const targetInput = document.getElementById(group.dataset.targetInput);
                    targetInput.value = targetInput.value === singleBtn.dataset.value ? '' : singleBtn.dataset.value;
                    group.querySelectorAll('.selectable-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === targetInput.value));
                }
                const multiBtn = e.target.closest('.selectable-multi-btn');
                if (multiBtn) {
                    multiBtn.classList.toggle('active');
                    const groupName = multiBtn.parentElement.dataset.groupName;
                    const outroInput = document.getElementById(`${groupName}Outro`);
                    if (outroInput) outroInput.classList.toggle('hidden', !multiBtn.parentElement.querySelector('[data-value="Outro"].active'));
                    const detailsInput = document.getElementById(`${groupName}Detalhes`);
                    if (detailsInput) {
                        const shouldShowDetails = Array.from(multiBtn.parentElement.querySelectorAll('.active[data-triggers-details="true"]')).length > 0;
                        detailsInput.classList.toggle('hidden', !shouldShowDetails);
                    }
                }
            });
            form.addEventListener('change', (e) => {
                const checkbox = e.target.closest('input[type="checkbox"][data-details]');
                if(checkbox) document.getElementById(checkbox.dataset.details).classList.toggle('hidden', !checkbox.checked);
            });
        };

        // --- Initialization ---
        const init = () => {
            loadRecords();
            renderRecords();
            setupEventListeners();
        };

        init();
    });