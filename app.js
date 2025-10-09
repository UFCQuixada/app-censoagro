document.addEventListener('DOMContentLoaded', () => {
    
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

    const STORAGE_KEY = 'censoQuixada2025_v3.3';
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
                        <p class="text-gray-600">${record.nomeFazenda || 'Propriedade não informada'}</p>
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
        form.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
        form.querySelectorAll('.hidden[data-logic-hidden]').forEach(el => el.classList.add('hidden'));
        
        if (recordId) {
            modalTitle.textContent = 'Editar Registro';
            const record = records.find(r => r.id == recordId);
            if (record) {
                form.elements['record-id'].value = record.id;
                Object.keys(record).forEach(key => {
                    const element = form.elements[key];
                     if (element) {
                        if(element.type === 'checkbox'){
                            element.checked = !!record[key];
                        } else if(element.tagName === 'SELECT'){
                            element.value = record[key] || "";
                        } else {
                            element.value = record[key];
                        }
                    }
                    const singleSelectGroup = form.querySelector(`.selectable-buttons[data-target-input="${key}"]`);
                    if(singleSelectGroup && record[key]){
                        const btn = singleSelectGroup.querySelector(`[data-value="${record[key]}"]`);
                        if(btn) btn.click();
                    }
                    const multiSelectGroup = form.querySelector(`.multi-selectable-buttons[data-group-name="${key}"]`);
                    if(multiSelectGroup && Array.isArray(record[key])) {
                        record[key].forEach(value => {
                            const btn = multiSelectGroup.querySelector(`[data-value="${value}"]`);
                            if(btn) btn.click();
                        });
                    }
                });
            }
        } else {
            modalTitle.textContent = 'Adicionar Novo Registro';
            form.elements['record-id'].value = '';
        }
        form.querySelectorAll('input, select').forEach(el => el.dispatchEvent(new Event('change', {bubbles: true})));
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
             if (key !== 'record-id') recordData[key] = value;
        }

        form.querySelectorAll('input[type=checkbox]').forEach(chk => {
            recordData[chk.name] = chk.checked;
        });

        form.querySelectorAll('.multi-selectable-buttons').forEach(group => {
            const groupName = group.dataset.groupName;
            recordData[groupName] = Array.from(group.querySelectorAll('.selectable-multi-btn.active')).map(btn => btn.dataset.value);
        });
        
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
            alert('Não há registros para exportar.'); return;
        }
        const sanitizeCell = (cell) => {
            if (cell === undefined || cell === null) return '';
            if (typeof cell === 'boolean') return cell ? 'Sim' : 'Nao';
            let cellStr = String(cell);
            if (cellStr.includes(',')) cellStr = `"${cellStr.replace(/"/g, '""')}"`;
            return cellStr;
        };
        const headers = [ 'id', 'date', 'nomeCompleto', 'cpf', 'sexo', 'escolaridade', 'escolaridadeOutro', 'telefone', 'tempoAtividade', 'nomeFazenda', 'localidade', 'distrito', 'latitude', 'longitude', 'areaTotal', 'areaProdutiva', 'numCAF', 'sucessaoFamiliar', 'sucessaoFamiliarQuem', 'participaAssociacao', 'participaCooperativa', 'participaSindicato', 'participaOutro', 'participaOrgOutro', 'faturamento', 'possePropria', 'posseArrendada', 'posseCedida', 'possePosse', 'posseAssentamento', 'posseOutro', 'posseTerraOutro', 'cultivaMilho', 'areaMilho', 'irrigadoMilho', 'cultivaFeijao', 'areaFeijao', 'irrigadoFeijao', 'cultivaMandioca', 'areaMandioca', 'irrigadoMandioca', 'cultivaHortalicas', 'tipoHortalicas', 'areaHortalicas', 'cultivaFruticultura', 'tipoFruticultura', 'areaFruticultura', 'cultivaOutras', 'outrasCulturas', 'criaBovinos', 'bovinosQtd', 'bovinosCorte', 'bovinosLeite', 'possuiTanque', 'tanqueCapacidade', 'produzQueijo', 'criaCaprinos', 'caprinosQtd', 'caprinosCorte', 'caprinosLeite', 'criaOvinos', 'ovinosQtd', 'ovinosCorte', 'ovinosRecria', 'criaSuinos', 'suinosQtd', 'suinosCorte', 'suinosRecria', 'criaAves', 'avesQtd', 'avesCorte', 'avesPostura', 'criaOutras', 'outrasCriacoes', 'temApicultura', 'temPiscicultura', 'temAgroindustria', 'agroindustriaQual', 'temTurismoRural', 'turismoRuralQual', 'fonteAguaPoco', 'fonteAguaAcude', 'fonteAguaCisterna', 'fonteAguaOutro', 'fonteAguaOutroQual', 'temEnergia', 'tipoEnergia', 'temTransporte', 'tipoTransporte', 'temTrator', 'qtdTrator', 'outrosEquipamentos', 'maoObraFamiliar', 'qtdMaoObraFamiliar', 'maoObraTemporaria', 'qtdMaoObraTemporaria', 'maoObraPermanente', 'qtdMaoObraPermanente', 'vendeConsumoProprio', 'vendeLocal', 'vendeFeira', 'vendeCooperativa', 'vendeLaticinios', 'vendeOutro', 'comercializacaoOutro', 'temAcessoCredito', 'interesseCredito', 'interesseCreditoQual', 'participaProgramaGov', 'programaPNAE', 'programaPAA', 'programaPRONAF', 'programaOutro', 'programasGovernoOutro', 'usaSoftwareGestao', 'softwareGestaoQual', 'usaApps', 'appsQuais', 'temInternet', 'internetMovel', 'internetRadio', 'internetSatelite', 'internetFibra', 'internetOutro', 'tipoInternetOutro', 'fazRegistroProducao', 'registroCaderno', 'registroPlanilha', 'registroBloco', 'registroOutro', 'registroProducaoOutro', 'temCertificacao', 'certifOrganico', 'certifSelo', 'certifRastreabilidade', 'certifOutro', 'certificacoesOutro', 'desafioAgua', 'desafioEstradas', 'desafioEnergia', 'desafioTransporte', 'desafioCredito', 'desafioMercado', 'desafioAssistencia', 'desafioOutro', 'dificuldadesOutro', 'observacoesFinais', 'lgpdConfirm' ];
        const csvRows = records.map(r => {
            const row = {
                ...r,
                participaAssociacao: r.participaOrg?.includes('Associação'), participaCooperativa: r.participaOrg?.includes('Cooperativa'), participaSindicato: r.participaOrg?.includes('Sindicato'), participaOutro: r.participaOrg?.includes('Outro'),
                possePropria: r.posseTerra?.includes('Própria'), posseArrendada: r.posseTerra?.includes('Arrendada'), posseCedida: r.posseTerra?.includes('Cedida'), possePosse: r.posseTerra?.includes('Posse'), posseAssentamento: r.posseTerra?.includes('Assentamento'), posseOutro: r.posseTerra?.includes('Outro'),
                bovinosCorte: r.bovinosFinalidade?.includes('Corte'), bovinosLeite: r.bovinosFinalidade?.includes('Leite'),
                caprinosCorte: r.caprinosFinalidade?.includes('Corte'), caprinosLeite: r.caprinosFinalidade?.includes('Leite'),
                ovinosCorte: r.ovinosFinalidade?.includes('Corte'), ovinosRecria: r.ovinosFinalidade?.includes('Recria'),
                suinosCorte: r.suinosFinalidade?.includes('Corte'), suinosRecria: r.suinosFinalidade?.includes('Recria'),
                avesCorte: r.avesFinalidade?.includes('Corte'), avesPostura: r.avesFinalidade?.includes('Postura'),
                fonteAguaPoco: r.fonteAgua?.includes('Poço'), fonteAguaAcude: r.fonteAgua?.includes('Açude'), fonteAguaCisterna: r.fonteAgua?.includes('Cisterna'), fonteAguaOutro: r.fonteAgua?.includes('Outro'),
                vendeConsumoProprio: r.comercializacao?.includes('Consumo próprio'), vendeLocal: r.comercializacao?.includes('Venda local'), vendeFeira: r.comercializacao?.includes('Feira'), vendeCooperativa: r.comercializacao?.includes('Cooperativa'), vendeLaticinios: r.comercializacao?.includes('Lacticínios'), vendeOutro: r.comercializacao?.includes('Outro'),
                programaPNAE: r.programasGoverno?.includes('PNAE'), programaPAA: r.programasGoverno?.includes('PAA'), programaPRONAF: r.programasGoverno?.includes('PRONAF'), programaOutro: r.programasGoverno?.includes('Outro'),
                internetMovel: r.tipoInternet?.includes('Movel'), internetRadio: r.tipoInternet?.includes('Radio'), internetSatelite: r.tipoInternet?.includes('Satelite'), internetFibra: r.tipoInternet?.includes('Fibra'), internetOutro: r.tipoInternet?.includes('Outro'),
                registroCaderno: r.registroProducaoTipo?.includes('Caderno de Campo'), registroPlanilha: r.registroProducaoTipo?.includes('Planilha'), registroBloco: r.registroProducaoTipo?.includes('Bloco'), registroOutro: r.registroProducaoTipo?.includes('Outro'),
                certifOrganico: r.certificacoesTipo?.includes('Orgânico'), certifSelo: r.certificacoesTipo?.includes('Selo de qualidade'), certifRastreabilidade: r.certificacoesTipo?.includes('Rastreabilidade'), certifOutro: r.certificacoesTipo?.includes('Outro'),
                desafioAgua: r.dificuldades?.includes('Água'), desafioEstradas: r.dificuldades?.includes('Estradas'), desafioEnergia: r.dificuldades?.includes('Energia'), desafioTransporte: r.dificuldades?.includes('Transporte'), desafioCredito: r.dificuldades?.includes('Crédito'), desafioMercado: r.dificuldades?.includes('Mercado'), desafioAssistencia: r.dificuldades?.includes('Assistência técnica'), desafioOutro: r.dificuldades?.includes('Outro'),
            };
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
        
        const handleButtonInteraction = (e) => {
            const singleBtn = e.target.closest('.selectable-btn');
            const multiBtn = e.target.closest('.selectable-multi-btn');

            if (!singleBtn && !multiBtn) return;
            
            e.preventDefault();
            
            if (singleBtn) {
                const group = singleBtn.parentElement;
                const targetInput = form.elements[group.dataset.targetInput];
                if (targetInput) {
                    targetInput.value = targetInput.value === singleBtn.dataset.value ? '' : singleBtn.dataset.value;
                    group.querySelectorAll('.selectable-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === targetInput.value));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            if (multiBtn) {
                multiBtn.classList.toggle('active');
                // Dispara um evento de change no próprio botão para ser capturado pelo listener do formulário
                multiBtn.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        form.addEventListener('click', handleButtonInteraction);
        form.addEventListener('touchstart', handleButtonInteraction);

        form.addEventListener('change', (e) => {
            const target = e.target;
            
            // Lógica para mostrar/esconder campos "Outro" para botões de múltipla seleção
            if (target.matches('.selectable-multi-btn[data-value="Outro"]')) {
                const groupName = target.parentElement.dataset.groupName;
                const outroMap = {
                    participaOrg: 'participaOrgOutro',
                    posseTerra: 'posseTerraOutro',
                    fonteAgua: 'fonteAguaOutroQual',
                    comercializacao: 'comercializacaoOutro',
                    programasGoverno: 'programasGovernoOutro',
                    tipoInternet: 'tipoInternetOutro',
                    registroProducaoTipo: 'registroProducaoOutro',
                    certificacoesTipo: 'certificacoesOutro',
                    dificuldades: 'dificuldadesOutro'
                };
                const outroInputName = outroMap[groupName];
                if (outroInputName) {
                    const outroInput = form.elements[outroInputName];
                    if (outroInput) {
                        outroInput.classList.toggle('hidden', !target.classList.contains('active'));
                    }
                }
            }

            // Lógica unificada para mostrar/esconder detalhes em checkboxes
            if(target.matches('input[type=checkbox]')){
                const detailsDiv = target.closest('label').nextElementSibling;
                if(detailsDiv) {
                   detailsDiv.classList.toggle('hidden', !target.checked);
                   detailsDiv.setAttribute('data-logic-hidden', '');
                }
            }

            // Lógica para campos que dependem de outros inputs (selects, botões de seleção única)
            const targetName = target.name;
            if (targetName === 'escolaridade') {
                form.elements.escolaridadeOutro.classList.toggle('hidden', target.value !== 'Outro');
            }
            if(targetName === 'sucessaoFamiliar') form.elements.sucessaoFamiliarQuem.classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'possuiTanque') form.elements.tanqueCapacidade.classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'temEnergia') document.getElementById('tipoEnergiaContainer').classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'temTransporte') form.elements.tipoTransporte.classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'temTrator') form.elements.qtdTrator.classList.toggle('hidden', target.value !== 'Sim');
            
            if(targetName === 'temAcessoCredito' || targetName === 'interesseCredito') {
                const temAcessoVal = form.elements.temAcessoCredito.value;
                const interesseVal = form.elements.interesseCredito.value;
                const showInteresseContainer = temAcessoVal === 'Não';
                document.getElementById('interesseCreditoContainer').classList.toggle('hidden', !showInteresseContainer);
                const showQualInput = temAcessoVal === 'Sim' || (showInteresseContainer && interesseVal === 'Sim');
                form.elements.interesseCreditoQual.classList.toggle('hidden', !showQualInput);
                if (!showInteresseContainer && interesseVal) {
                    form.elements.interesseCredito.value = '';
                    const btnGroup = document.querySelector('[data-target-input="interesseCredito"]');
                    btnGroup.querySelector('.active')?.classList.remove('active');
                }
            }

            if(targetName === 'participaProgramaGov') document.getElementById('programasGovContainer').classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'usaSoftwareGestao') form.elements.softwareGestaoQual.classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'usaApps') form.elements.appsQuais.classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'temInternet') document.getElementById('tipoInternetContainer').classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'fazRegistroProducao') document.getElementById('registroProducaoContainer').classList.toggle('hidden', target.value !== 'Sim');
            if(targetName === 'temCertificacao') document.getElementById('certificacaoContainer').classList.toggle('hidden', target.value !== 'Sim');
        });
    };

    const init = () => {
        loadRecords();
        renderRecords();
        setupEventListeners();
    };

    init();
});
