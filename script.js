// ============================================================
// MUNDO MAROMBA FIT - SISTEMA DE LOTES (FIFO)
// ============================================================

// Variáveis globais
let currentUser = null;

// ============================================================
// TABELA DE TAXAS DA MAQUINETA (PROMOÇÃO 3 MESES)
// ============================================================
const TAXAS_MAQUINETA = {
    debito: 0.0057,
    credito_1x: 0.0057,
    credito_2x: 0.0397,
    credito_3x: 0.0397,
    credito_4x: 0.0497,
    credito_5x: 0.0697,
    credito_6x: 0.0697,
    credito_7x: 0.0797,
    credito_8x: 0.0797,
    credito_9x: 0.0797,
    credito_10x: 0.0797,
    credito_11x: 0.0797,
    credito_12x: 0.0797,
    credito_13x: 0.1487,
    credito_14x: 0.1487,
    credito_15x: 0.1487,
    credito_16x: 0.1487,
    credito_17x: 0.1487,
    credito_18x: 0.1487
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    
    // Página de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', fazerLogin);
        return;
    }
    
    // Dashboard
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnSidebar = document.getElementById('logoutBtnSidebar');
    
    if (logoutBtn || logoutBtnSidebar) {
        verificarLogin();
        
        // Configurar navegação da sidebar
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => mudarAba(btn.dataset.tab));
        });
        
        // Compatibilidade com abas antigas (caso ainda existam)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => mudarAba(btn.dataset.tab));
        });
        
        // Configurar formulários
        document.getElementById('vendaForm')?.addEventListener('submit', registrarVenda);
        document.getElementById('compraForm')?.addEventListener('submit', registrarCompra);
        document.getElementById('perdaForm')?.addEventListener('submit', registrarPerda);
        document.getElementById('atualizarRelatorio')?.addEventListener('click', carregarRelatorio);
        
        // FORMULÁRIO DE MARCAS
        const marcaForm = document.getElementById('marcaForm');
        if (marcaForm) {
            marcaForm.addEventListener('submit', salvarMarca);
            console.log('✅ Evento do formulário de marcas configurado');
        }
        
        // Calcular unitário na compra
        document.getElementById('valorTotal')?.addEventListener('input', calcularUnitario);
        document.getElementById('quantidadeCompra')?.addEventListener('input', calcularUnitario);
        
        // Carregar dados iniciais
        carregarSelectProdutos();
        carregarEstoqueLotes();
        carregarRelatorio();
        
        // Recalcular quando o valor total for alterado manualmente
        document.getElementById('previewTotal')?.addEventListener('input', function() {
            calcularPreview();
        });
        
        document.getElementById('quantidadeVenda')?.addEventListener('input', function() {
            const precoUnitario = parseFloat(document.getElementById('precoVenda').value) || 0;
            const quantidade = parseInt(this.value) || 1;
            if (precoUnitario > 0) {
                document.getElementById('previewTotal').value = (precoUnitario * quantidade).toFixed(2);
            }
            calcularPreview();
        });
        
        // Eventos do histórico
        document.getElementById('filtroPeriodoHistorico')?.addEventListener('change', carregarHistoricoVendas);
        document.getElementById('aplicarFiltrosHistorico')?.addEventListener('click', carregarHistoricoVendas);
        document.getElementById('filtroClienteHistorico')?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') carregarHistoricoVendas();
        });
        
        // Eventos para calcular preview
        document.getElementById('pagamentoVenda')?.addEventListener('change', function() {
            toggleParcelas();
            calcularPreview();
        });
        document.getElementById('parcelasVenda')?.addEventListener('change', calcularPreview);
        document.getElementById('precoVenda')?.addEventListener('input', calcularPreview);
        document.getElementById('quantidadeVenda')?.addEventListener('input', calcularPreview);
        
        // Eventos dos filtros do estoque
        document.getElementById('filtroMarca')?.addEventListener('change', carregarEstoqueLotes);
        document.getElementById('filtroFamilia')?.addEventListener('change', carregarEstoqueLotes);
        document.getElementById('limparFiltros')?.addEventListener('click', function() {
            document.getElementById('filtroMarca').value = '';
            document.getElementById('filtroFamilia').value = '';
            carregarEstoqueLotes();
        });
        
        // Evento para buscar informações do produto ao selecionar
        document.getElementById('produtoVenda')?.addEventListener('change', function() {
            buscarInfoProduto();
            preencherPrecoSugerido();
        });
        
        // Se a aba de marcas estiver visível, carregar marcas
        if (document.getElementById('marcas')?.classList.contains('active')) {
            carregarMarcas();
        }
document.getElementById('toggleModoEstoque')?.addEventListener('click', toggleModoEstoque);
    }
});

// ============================================================
// AUTENTICAÇÃO
// ============================================================
async function fazerLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('loginMessage');
    
    try {
        const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
        currentUser = userCredential.user;
        messageDiv.innerHTML = 'Login realizado! Redirecionando...';
        messageDiv.className = 'message sucesso';
        setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } catch (error) {
        messageDiv.innerHTML = 'Erro: ' + error.message;
        messageDiv.className = 'message erro';
    }
}

function verificarLogin() {
    window.onAuthStateChanged(window.auth, (user) => {
        if (user) {
            currentUser = user;
            // Atualizar email na sidebar e no header (se existir)
            const emailSpan = document.getElementById('userEmail');
            const emailSidebar = document.getElementById('userEmailSidebar');
            if (emailSpan) emailSpan.innerText = user.email;
            if (emailSidebar) emailSidebar.innerText = user.email;
        } else {
            window.location.href = 'index.html';
        }
    });
}

// ============================================================
// LOGOUT (compatível com ambos os botões)
// ============================================================
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await window.signOut(window.auth);
    window.location.href = 'index.html';
});

document.getElementById('logoutBtnSidebar')?.addEventListener('click', async () => {
    await window.signOut(window.auth);
    window.location.href = 'index.html';
});

// ============================================================
// TABS (adaptado para sidebar)
// ============================================================
function mudarAba(abaId) {
    // Esconder todas as abas
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    // Remover active dos botões da sidebar
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Remover active das abas antigas (se existirem)
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Mostrar aba selecionada
    const targetTab = document.getElementById(abaId);
    if (targetTab) targetTab.classList.add('active');
    
    // Ativar botão da sidebar correspondente
    const navBtn = document.querySelector(`.nav-btn[data-tab="${abaId}"]`);
    if (navBtn) navBtn.classList.add('active');
    
    // Ativar botão de aba antigo (se existir)
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${abaId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    
    // Carregar dados específicos da aba
    if (abaId === 'estoque') carregarEstoqueLotes();
    if (abaId === 'vendas') carregarSelectProdutos();
    if (abaId === 'relatorios') carregarRelatorio();
    if (abaId === 'marcas') carregarMarcas();
    if (abaId === 'historico') carregarHistoricoVendas();
}

// ============================================================
// COMPRAS (CRIA NOVO LOTE)
// ============================================================
function calcularUnitario() {
    const valorTotal = parseFloat(document.getElementById('valorTotal')?.value) || 0;
    const quantidade = parseInt(document.getElementById('quantidadeCompra')?.value) || 1;
    
    if (valorTotal > 0 && quantidade > 0) {
        const unitario = valorTotal / quantidade;
        document.getElementById('valorUnitario').value = unitario.toFixed(2);
        document.getElementById('simulacao40').value = (unitario * 1.4).toFixed(2);
    }
}

async function registrarCompra(event) {
    event.preventDefault();
    
    const lote = {
        produto: document.getElementById('nome').value.trim(),
        marca: document.getElementById('marca').value.trim(),
        sabor: document.getElementById('sabor').value.trim() || 'Sem sabor',
        peso: document.getElementById('peso').value.trim(),
        familia: document.getElementById('familia').value,
        dataCompra: document.getElementById('dataCompra').value,
        quantidade: parseInt(document.getElementById('quantidadeCompra').value),
        custoUnitario: parseFloat(document.getElementById('valorUnitario').value),
        valorTotal: parseFloat(document.getElementById('valorTotal').value),
        valorSugerido: parseFloat(document.getElementById('valorSugerido').value) || null,
        simulacao40: parseFloat(document.getElementById('simulacao40').value),
        socio: document.getElementById('socio').value,
        fornecedor: document.getElementById('fornecedor').value,
        vendido: 0,
        ativo: true,
        dataCriacao: new Date().toISOString(),
        imagemUrl: document.getElementById('imagemProduto').value.trim() || '',
    };
    
    try {
        await window.addDoc(window.collection(window.db, 'lotes'), lote);
        await window.addDoc(window.collection(window.db, 'compras'), {
            ...lote,
            tipo: 'compra'
        });
        
        mostrarNotificacao(`Lote registrado! ${lote.quantidade} un. a R$ ${lote.custoUnitario.toFixed(2)}`, 'sucesso');
        document.getElementById('compraForm').reset();
        
        carregarEstoqueLotes();
        carregarSelectProdutos();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(`Erro ao registrar compra: ${error.message}`, 'erro');
    }
}

// ============================================================
// VENDAS (FIFO - PRIMEIRO QUE ENTRA, PRIMEIRO QUE SAI)
// ============================================================
async function registrarVenda(event) {
    event.preventDefault();
    
    const produtoNome = document.getElementById('produtoVenda').value;
    const quantidadeVenda = parseInt(document.getElementById('quantidadeVenda').value);
    const precoVenda = parseFloat(document.getElementById('precoVenda').value);
    
    if (!produtoNome) {
        mostrarNotificacao('Selecione um produto!', 'erro');
        return;
    }
    
    try {
        const q = window.query(
            window.collection(window.db, 'lotes'),
            window.where('produto', '==', produtoNome),
            window.where('ativo', '==', true)
        );
        const snapshot = await window.getDocs(q);
        
        const lotesDisponiveis = [];
        snapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo > 0) {
                lotesDisponiveis.push({
                    id: doc.id,
                    ...l,
                    saldo: saldo
                });
            }
        });
        
        lotesDisponiveis.sort((a, b) => new Date(a.dataCompra) - new Date(b.dataCompra));
        
        const totalDisponivel = lotesDisponiveis.reduce((acc, l) => acc + l.saldo, 0);
        if (totalDisponivel < quantidadeVenda) {
            throw new Error(`Estoque insuficiente! Disponível: ${totalDisponivel} unidades.`);
        }
        
        let quantidadeRestante = quantidadeVenda;
        let custoTotal = 0;
        const lotesUtilizados = [];
        
        for (const lote of lotesDisponiveis) {
            if (quantidadeRestante <= 0) break;
            
            const usar = Math.min(quantidadeRestante, lote.saldo);
            custoTotal += usar * lote.custoUnitario;
            
            lotesUtilizados.push({
                loteId: lote.id,
                quantidade: usar,
                custoUnitario: lote.custoUnitario,
                dataCompra: lote.dataCompra
            });
            
            const novoVendido = lote.vendido + usar;
            await window.updateDoc(window.doc(window.db, 'lotes', lote.id), {
                vendido: novoVendido,
                ativo: novoVendido < lote.quantidade
            });
            
            quantidadeRestante -= usar;
        }
        
        const venda = {
            produto: produtoNome,
            quantidade: quantidadeVenda,
            precoUnitario: precoVenda,
            valorTotal: precoVenda * quantidadeVenda,
            custoTotal: custoTotal,
            lucro: (precoVenda * quantidadeVenda) - custoTotal,
            pagamento: document.getElementById('pagamentoVenda').value,
            parcelas: parseInt(document.getElementById('parcelasVenda').value) || 1,
            taxa: parseFloat(document.getElementById('taxaDisplay').value.replace('%', '').replace('-', '')) / 100 || 0,
            valorLiquido: parseFloat(document.getElementById('previewLiquido').value.replace('R$ ', '').replace(',', '.')) || 0,
            cliente: document.getElementById('clienteVenda').value || 'Cliente não identificado',
            contato: document.getElementById('contatoVenda').value || '',
            data: new Date().toISOString(),
            vendedor: currentUser?.email,
            lotesUtilizados: lotesUtilizados
        };
        
        await window.addDoc(window.collection(window.db, 'vendas'), venda);
        mostrarNotificacao(`Venda registrada! ${quantidadeVenda} un. | Total: R$ ${venda.valorTotal.toFixed(2)}`, 'sucesso');
        document.getElementById('vendaForm').reset();
        
        carregarEstoqueLotes();
        carregarSelectProdutos();
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(`Erro ao registrar venda: ${error.message}`, 'erro');
    }
}

// ============================================================
// PERDAS
// ============================================================
async function registrarPerda(event) {
    event.preventDefault();
    
    const produtoId = document.getElementById('produtoPerda').value;
    const quantidade = parseInt(document.getElementById('quantidadePerda').value);
    const motivo = document.getElementById('motivoPerda').value;
    
    if (!produtoId) {
        mostrarNotificacao('Selecione um produto!', 'erro');
        return;
    }
    
    try {
        const docRef = window.doc(window.db, 'lotes', produtoId);
        const docSnap = await window.getDoc(docRef);
        const lote = docSnap.data();
        const saldo = lote.quantidade - lote.vendido;
        
        if (saldo < quantidade) {
            throw new Error(`Saldo insuficiente! Disponível: ${saldo} unidades.`);
        }
        
        const perda = {
            produto: lote.produto,
            marca: lote.marca,
            sabor: lote.sabor,
            quantidade: quantidade,
            valorUnitario: lote.custoUnitario,
            valorTotal: lote.custoUnitario * quantidade,
            motivo: motivo,
            data: new Date().toISOString(),
            registradoPor: currentUser?.email,
            loteId: produtoId
        };
        
        await window.addDoc(window.collection(window.db, 'perdas'), perda);
        
        const novoVendido = lote.vendido + quantidade;
        await window.updateDoc(docRef, {
            vendido: novoVendido,
            ativo: novoVendido < lote.quantidade
        });
        
        mostrarNotificacao(`Perda registrada! ${quantidade} un. - ${motivo}`, 'aviso');
        document.getElementById('perdaForm').reset();
        
        carregarEstoqueLotes();
        carregarSelectProdutos();
        
    } catch (error) {
        mostrarNotificacao(`Erro ao registrar perda: ${error.message}`, 'erro');
    }
}

// ============================================================
// PARCELAS - MOSTRAR/ESCONDER
// ============================================================
function toggleParcelas() {
    const pagamento = document.getElementById('pagamentoVenda').value;
    const parcelasRow = document.getElementById('parcelasRow');
    if (pagamento === 'Crédito') {
        parcelasRow.style.display = 'flex';
    } else {
        parcelasRow.style.display = 'none';
        document.getElementById('parcelasVenda').value = '1';
        document.getElementById('taxaDisplay').value = '0%';
    }
    calcularPreview();
}

// ============================================================
// CALCULAR PREVIEW DA VENDA COM TAXA E CUSTO REAL
// ============================================================
async function calcularPreview() {
    const pagamento = document.getElementById('pagamentoVenda').value;
    const quantidade = parseInt(document.getElementById('quantidadeVenda').value) || 1;
    const parcelas = parseInt(document.getElementById('parcelasVenda').value) || 1;
    const produtoNome = document.getElementById('produtoVenda').value;
    
    const valorTotal = parseFloat(document.getElementById('previewTotal').value) || 0;
    
    let taxa = 0;
    let taxaLabel = '0%';
    
    if (pagamento === 'Pix' || pagamento === 'Dinheiro') {
        taxa = 0;
        taxaLabel = '0%';
    } else if (pagamento === 'Débito') {
        taxa = TAXAS_MAQUINETA.debito;
        taxaLabel = '-0,57%';
    } else if (pagamento === 'Crédito') {
        const key = `credito_${parcelas}x`;
        taxa = TAXAS_MAQUINETA[key] || 0;
        taxaLabel = `-${(taxa * 100).toFixed(2)}%`;
    }
    
    const valorLiquido = valorTotal * (1 - taxa);
    
    let custoUnitarioReal = 0;
    if (produtoNome) {
        try {
            const q = window.query(
                window.collection(window.db, 'lotes'),
                window.where('produto', '==', produtoNome),
                window.where('ativo', '==', true)
            );
            const snapshot = await window.getDocs(q);
            
            let totalCusto = 0;
            let totalUnidades = 0;
            snapshot.forEach(doc => {
                const l = doc.data();
                const saldo = l.quantidade - l.vendido;
                if (saldo > 0) {
                    totalCusto += saldo * l.custoUnitario;
                    totalUnidades += saldo;
                }
            });
            
            if (totalUnidades > 0) {
                custoUnitarioReal = totalCusto / totalUnidades;
            }
        } catch (error) {
            console.error('Erro ao buscar custo real:', error);
        }
    }
    
    const custoTotalReal = custoUnitarioReal * quantidade;
    const lucroReal = valorLiquido - custoTotalReal;
    
    document.getElementById('taxaDisplay').value = taxaLabel;
    document.getElementById('previewLiquido').value = `R$ ${valorLiquido.toFixed(2)}`;
    document.getElementById('previewLucro').value = `R$ ${lucroReal.toFixed(2)}`;
    
    const precoUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
    document.getElementById('precoVenda').value = precoUnitario.toFixed(2);
}

// ============================================================
// BUSCAR INFORMAÇÕES DO PRODUTO PARA EXIBIÇÃO
// ============================================================
async function buscarInfoProduto() {
    const produtoNome = document.getElementById('produtoVenda').value;
    const infoDiv = document.getElementById('infoProduto');
    
    if (!produtoNome) {
        infoDiv.style.display = 'none';
        return;
    }
    
    try {
        const q = window.query(
            window.collection(window.db, 'lotes'),
            window.where('produto', '==', produtoNome),
            window.where('ativo', '==', true)
        );
        const snapshot = await window.getDocs(q);
        
        let totalCusto = 0;
        let totalUnidades = 0;
        let valorSugerido = null;
        
        snapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo > 0) {
                totalCusto += saldo * l.custoUnitario;
                totalUnidades += saldo;
                if (l.valorSugerido) {
                    valorSugerido = l.valorSugerido;
                }
            }
        });
        
        if (totalUnidades === 0) {
            infoDiv.style.display = 'none';
            return;
        }
        
        const custoMedio = totalCusto / totalUnidades;
        const margemBruta = valorSugerido ? ((valorSugerido - custoMedio) / valorSugerido * 100) : 0;
        
        document.getElementById('custoExibicao').textContent = `R$ ${custoMedio.toFixed(2)}`;
        document.getElementById('sugeridoExibicao').textContent = valorSugerido ? `R$ ${valorSugerido.toFixed(2)}` : '⚠️ Não definido';
        document.getElementById('margemExibicao').textContent = valorSugerido ? `${margemBruta.toFixed(1)}%` : '⚠️ Defina o preço';
        document.getElementById('margemExibicao').style.color = margemBruta > 40 ? '#4caf50' : margemBruta > 20 ? '#ff9800' : '#f44336';
        
        infoDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao buscar informações do produto:', error);
        infoDiv.style.display = 'none';
    }
}

// ============================================================
// PREENCHER PREÇO SUGERIDO AUTOMATICAMENTE
// ============================================================
async function preencherPrecoSugerido() {
    const produtoNome = document.getElementById('produtoVenda').value;
    const quantidade = parseInt(document.getElementById('quantidadeVenda').value) || 1;
    
    if (!produtoNome) {
        document.getElementById('previewTotal').value = 0;
        await calcularPreview();
        return;
    }
    
    try {
        const q = window.query(
            window.collection(window.db, 'lotes'),
            window.where('produto', '==', produtoNome),
            window.where('ativo', '==', true)
        );
        const snapshot = await window.getDocs(q);
        
        let valorSugerido = null;
        snapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo > 0 && l.valorSugerido) {
                valorSugerido = l.valorSugerido;
            }
        });
        
        if (valorSugerido) {
            document.getElementById('previewTotal').value = (valorSugerido * quantidade).toFixed(2);
        } else {
            document.getElementById('previewTotal').value = 0;
        }
        
        await calcularPreview();
        await buscarInfoProduto();
        
    } catch (error) {
        console.error('Erro ao buscar preço sugerido:', error);
    }
}
// ============================================================
// ESTOQUE - VITRINE DIGITAL + MODO INTERNO (CORRIGIDO)
// ============================================================

let modoInternoAtivo = false;

async function carregarEstoqueLotes() {
    try {
        const filtroMarca = document.getElementById('filtroMarca')?.value || '';
        const filtroFamilia = document.getElementById('filtroFamilia')?.value || '';
        
        const marcasSnapshot = await window.getDocs(window.collection(window.db, 'marcas'));
        const logos = {};
        marcasSnapshot.forEach(doc => {
            const m = doc.data();
            logos[m.nome] = m.logoUrl || '';
        });
        
        const snapshot = await window.getDocs(window.collection(window.db, 'lotes'));
        const listaDiv = document.getElementById('estoqueLista');
        
        if (!listaDiv) return;
        
        if (snapshot.empty) {
            listaDiv.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#888;">
                    <i class="fas fa-box-open" style="font-size:48px; color:#333;"></i>
                    <p style="margin-top:15px;">Nenhum produto cadastrado.</p>
                    <p style="font-size:14px;">Registre uma compra na aba "Compras" para começar.</p>
                </div>
            `;
            return;
        }
        
        preencherFiltros(snapshot);
        
        const produtos = {};
        snapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo <= 0) return;
            
            if (filtroMarca && l.marca !== filtroMarca) return;
            if (filtroFamilia && l.familia !== filtroFamilia) return;
            
            const chave = `${l.produto}|${l.marca}|${l.sabor}|${l.peso}`;
            if (!produtos[chave]) {
                produtos[chave] = {
                    produto: l.produto,
                    marca: l.marca,
                    sabor: l.sabor,
                    peso: l.peso,
                    familia: l.familia || 'Outros',
                    imagemUrl: l.imagemUrl || '',
                    totalDisponivel: 0,
                    valorSugerido: null,
                    custoUnitario: l.custoUnitario || 0,
                    lotes: []
                };
            }
            produtos[chave].lotes.push({
                id: doc.id,
                dataCompra: l.dataCompra,
                quantidade: l.quantidade,
                vendido: l.vendido,
                saldo: saldo,
                custoUnitario: l.custoUnitario,
                valorSugerido: l.valorSugerido,
                simulacao40: l.simulacao40 || l.custoUnitario * 1.4
            });
            produtos[chave].totalDisponivel += saldo;
            if (l.valorSugerido && !produtos[chave].valorSugerido) {
                produtos[chave].valorSugerido = l.valorSugerido;
            }
        });
        
        if (Object.keys(produtos).length === 0) {
            listaDiv.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#888;">
                    <i class="fas fa-search" style="font-size:48px; color:#333;"></i>
                    <p style="margin-top:15px;">Nenhum produto encontrado com os filtros selecionados.</p>
                </div>
            `;
            return;
        }
        
        const grupos = {};
        for (const chave in produtos) {
            const p = produtos[chave];
            if (!grupos[p.familia]) {
                grupos[p.familia] = [];
            }
            grupos[p.familia].push(p);
        }
        
        const familiasOrdenadas = Object.keys(grupos).sort();
        
        let html = '';
        
        for (const familia of familiasOrdenadas) {
            const items = grupos[familia];
            
            html += `
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; border-bottom: 2px solid rgba(245, 166, 35, 0.15); padding-bottom: 8px;">
                        <i class="fas fa-tag" style="color: #F5A623; font-size: 18px;"></i>
                        <span style="font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 1px;">${familia.toUpperCase()}</span>
                        <span style="color: #888; font-size: 14px; font-weight: 400;">(${items.length} produtos)</span>
                        ${modoInternoAtivo ? `<span style="color: #ff9800; font-size: 12px; font-weight: 600;"><i class="fas fa-lock"></i> MODO INTERNO</span>` : ''}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(${modoInternoAtivo ? '440px' : '180px'}, 1fr)); gap: 18px;">
            `;
            
            for (const p of items) {
                const logoUrl = logos[p.marca] || '';
                const valorSugerido = p.valorSugerido || p.lotes[0]?.valorSugerido || null;
                
                if (modoInternoAtivo) {
    // ===== MODO INTERNO - VISUAL MODERNO =====
    const lucroTotalGeral = p.lotes.reduce((acc, l) => acc + ((l.valorSugerido || 0) - l.custoUnitario) * l.quantidade, 0);
    const custoTotalGeral = p.lotes.reduce((acc, l) => acc + l.custoUnitario * l.quantidade, 0);
    const margemMedia = p.lotes.reduce((acc, l) => acc + ((l.valorSugerido || 0) - l.custoUnitario) / (l.valorSugerido || 1) * 100, 0) / p.lotes.length;
    
    html += `
        <div style="
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 20px 22px;
            border: 1px solid rgba(245,166,35,0.12);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        "
        onmouseover="this.style.borderColor='rgba(245,166,35,0.35)'; this.style.background='rgba(255,255,255,0.06)'; this.style.boxShadow='0 8px 40px rgba(0,0,0,0.25)';"
        onmouseout="this.style.borderColor='rgba(245,166,35,0.12)'; this.style.background='rgba(255,255,255,0.03)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.15)';"
        >
            <!-- CABEÇALHO DO PRODUTO -->
            <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <!-- Imagem -->
                <div style="
                    width:70px; height:70px; 
                    background:rgba(255,255,255,0.05); 
                    border-radius:14px; 
                    overflow:hidden; 
                    display:flex; 
                    align-items:center; 
                    justify-content:center;
                    flex-shrink:0;
                    border:1px solid rgba(255,255,255,0.05);
                ">
                    ${p.imagemUrl && p.imagemUrl.trim() !== '' ? 
                        `<img src="${p.imagemUrl}" alt="${p.produto}" style="width:100%; height:100%; object-fit:contain; padding:6px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'color:#555; font-size:28px;\\'><i class=\\'fas fa-box\\'></i></span>';">` :
                        `<span style="color:#555; font-size:28px;"><i class="fas fa-box"></i></span>`
                    }
                </div>
                
                <!-- Nome e Marca -->
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${logoUrl ? 
                            `<img src="${logoUrl}" alt="${p.marca}" style="width:24px; height:24px; object-fit:contain; border-radius:6px;">` :
                            `<span style="color:#666; font-size:14px;"><i class="fas fa-tag"></i></span>`
                        }
                        <span style="font-size:13px; color:#F5A623; font-weight:600;">${p.marca}</span>
                        <span style="color:#444; font-size:16px; font-weight:300;">|</span>
                        <span style="font-size:18px; font-weight:700; color:#fff;">${p.produto}</span>
                    </div>
                    <div style="font-size:13px; color:#888; margin-top:2px;">
                        <i class="fas fa-weight-hanging" style="color:#666; margin-right:4px;"></i> ${p.peso}
                        ${p.sabor && p.sabor !== 'Sem sabor' ? `• <i class="fas fa-utensils" style="color:#666; margin-right:4px;"></i> ${p.sabor}` : ''}
                        <span style="margin-left:12px; color:#4caf50; font-weight:600;">
                            <i class="fas fa-box" style="font-size:11px;"></i> ${p.totalDisponivel} un. disponíveis
                        </span>
                    </div>
                </div>
                
                <!-- Preço Sugerido (destaque) -->
                <div style="text-align:right; flex-shrink:0;">
                    <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:0.5px;">Preço sugerido</div>
                    <div style="font-size:26px; font-weight:900; color:#F5A623; text-shadow:0 0 40px rgba(245,166,35,0.15);">
                        ${valorSugerido ? `R$ ${valorSugerido.toFixed(2)}` : '—'}
                    </div>
                </div>
            </div>
            
            <!-- LISTA DE LOTES -->
            <div style="display:grid; gap:12px; margin-bottom:16px;">
                <div style="display:grid; grid-template-columns: 1fr 0.5fr 0.8fr 1fr 1fr; gap:6px; font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; padding:0 4px 6px 4px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span><i class="far fa-calendar-alt" style="margin-right:4px;"></i> Lote</span>
                    <span style="text-align:center;"><i class="fas fa-box" style="margin-right:4px;"></i> Qtd</span>
                    <span style="text-align:right;"><i class="fas fa-tag" style="margin-right:4px;"></i> Custo</span>
                    <span style="text-align:right;"><i class="fas fa-coins" style="margin-right:4px;"></i> Custo Total</span>
                    <span style="text-align:right;"><i class="fas fa-chart-line" style="margin-right:4px;"></i> Lucro Total</span>
                </div>
    `;
    
    p.lotes.forEach(lote => {
        const custoTotal = lote.custoUnitario * lote.quantidade;
        const lucroUnitario = lote.valorSugerido ? (lote.valorSugerido - lote.custoUnitario) : 0;
        const lucroTotalLote = lucroUnitario * lote.quantidade;
        const margem = lote.valorSugerido ? ((lote.valorSugerido - lote.custoUnitario) / lote.valorSugerido * 100) : 0;
        
        html += `
            <div style="
                background: rgba(0,0,0,0.2);
                border-radius:12px;
                padding:10px 12px;
                border-left:3px solid ${lucroTotalLote > 0 ? '#4caf50' : '#f44336'};
                transition: all 0.2s ease;
            "
            onmouseover="this.style.background='rgba(0,0,0,0.35)';"
            onmouseout="this.style.background='rgba(0,0,0,0.2)';"
            >
                <div style="display:grid; grid-template-columns: 1fr 0.5fr 0.8fr 1fr 1fr; gap:6px; align-items:center;">
                    <span style="color:#ccc; font-weight:600; font-size:13px;">${lote.dataCompra}</span>
                    <span style="text-align:center; color:#4caf50; font-weight:700; font-size:15px;">${lote.quantidade}</span>
                    <span style="text-align:right; color:#ff9800; font-weight:500;">R$ ${lote.custoUnitario.toFixed(2)}</span>
                    <span style="text-align:right; color:#ff9800; font-weight:600;">R$ ${custoTotal.toFixed(2)}</span>
                    <span style="text-align:right; color:#4caf50; font-weight:700; font-size:15px;">R$ ${lucroTotalLote.toFixed(2)}</span>
                </div>
                <div style="display:flex; gap:20px; margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.03); flex-wrap:wrap;">
                    <span style="font-size:12px; color:#888;">
                        <i class="fas fa-coins" style="color:#4caf50; margin-right:4px;"></i> 
                        Lucro unitário: <strong style="color:#4caf50;">R$ ${lucroUnitario.toFixed(2)}</strong>
                    </span>
                    <span style="font-size:12px; color:#888;">
                        <i class="fas fa-percent" style="color:#F5A623; margin-right:4px;"></i> 
                        Margem: <strong style="color:#F5A623;">${margem.toFixed(1)}%</strong>
                    </span>
                    <span style="font-size:12px; color:#888;">
                        <i class="fas fa-calendar-alt" style="color:#666; margin-right:4px;"></i> 
                        Vendido: <strong style="color:#aaa;">${lote.vendido}</strong>
                    </span>
                </div>
            </div>
        `;
    });
    
    // RESULTADOS DO PRODUTO
    html += `
            </div>
            
            <!-- RESULTADOS DO PRODUTO -->
            <div style="
                display:grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap:10px; 
                background: rgba(0,0,0,0.25); 
                border-radius:14px; 
                padding:14px 16px;
                border:1px solid rgba(255,255,255,0.04);
            ">
                <div style="text-align:center;">
                    <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px;">Custo Total</div>
                    <div style="font-size:16px; font-weight:700; color:#ff9800;">R$ ${custoTotalGeral.toFixed(2)}</div>
                </div>
                <div style="text-align:center; border-left:1px solid rgba(255,255,255,0.06); border-right:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px;">💚 Lucro Total</div>
                    <div style="font-size:20px; font-weight:900; color:#4caf50;">R$ ${lucroTotalGeral.toFixed(2)}</div>
                </div>
                <div style="text-align:center; border-right:1px solid rgba(255,255,255,0.06);">
                    <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px;">📊 Margem Média</div>
                    <div style="font-size:16px; font-weight:700; color:#F5A623;">${margemMedia.toFixed(1)}%</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px;">📦 Estoque</div>
                    <div style="font-size:16px; font-weight:700; color:#4caf50;">${p.totalDisponivel} un.</div>
                </div>
            </div>
            
            <!-- BOTÃO EDITAR -->
            <button onclick="window.location.href='editar-produto.html?id=${p.lotes[0].id}'" style="
                margin-top:14px;
                width:100%;
                background: rgba(245, 166, 35, 0.08);
                border: 1px solid rgba(245, 166, 35, 0.12);
                color: #F5A623;
                padding: 10px 16px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Inter', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            "
            onmouseover="this.style.background='rgba(245, 166, 35, 0.18)'; this.style.borderColor='rgba(245, 166, 35, 0.3)';"
            onmouseout="this.style.background='rgba(245, 166, 35, 0.08)'; this.style.borderColor='rgba(245, 166, 35, 0.12)';"
            >
                <i class="fas fa-edit"></i> Editar Lote
            </button>
        </div>
    `;
}
                     else {
                    // ===== MODO VITRINE =====
                    html += `
                        <div class="produto-card" style="
                            background: rgba(255,255,255,0.03);
                            border-radius: 16px;
                            padding: 16px 14px 18px;
                            border: 1px solid rgba(255,255,255,0.06);
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            text-align: center;
                            cursor: default;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            backdrop-filter: blur(10px);
                        "
                        onmouseover="this.style.transform='translateY(-6px)'; this.style.borderColor='rgba(245,166,35,0.3)'; this.style.boxShadow='0 12px 40px rgba(0,0,0,0.4)'; this.style.background='rgba(255,255,255,0.06)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(255,255,255,0.06)'; this.style.boxShadow='none'; this.style.background='rgba(255,255,255,0.03)';"
                        >
                            <div style="width:120px; height:120px; background:rgba(255,255,255,0.05); border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:10px; flex-shrink:0; border:1px solid rgba(255,255,255,0.05);">
                                ${p.imagemUrl && p.imagemUrl.trim() !== '' ? 
                                    `<img src="${p.imagemUrl}" alt="${p.produto}" style="width:100%; height:100%; object-fit:contain; padding:4px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'color:#555; font-size:32px;\\'><i class=\\'fas fa-box\\'></i></span>';">` :
                                    `<span style="color:#555; font-size:32px;"><i class="fas fa-box"></i></span>`
                                }
                            </div>
                            
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                ${logoUrl ? `<img src="${logoUrl}" alt="${p.marca}" style="width:18px; height:18px; object-fit:contain; border-radius:4px;">` : `<span style="color:#666; font-size:12px;"><i class="fas fa-tag"></i></span>`}
                                <span style="font-size:12px; color:#888; font-weight:500;">${p.marca}</span>
                            </div>
                            
                            <div style="font-weight:700; font-size:15px; color:#fff; line-height:1.2; margin-bottom:2px;">${p.produto}</div>
                            <div style="font-size:12px; color:#666; margin-bottom:8px;">${p.peso} ${p.sabor && p.sabor !== 'Sem sabor' ? `• ${p.sabor}` : ''}</div>
                            
                            <div style="font-size:22px; font-weight:800; color:#F5A623; letter-spacing:-0.5px; margin-bottom:4px; text-shadow:0 0 30px rgba(245,166,35,0.1);">
                                ${valorSugerido ? `R$ ${valorSugerido.toFixed(2)}` : '—'}
                            </div>
                            
                            <div style="font-size:12px; color:#4caf50; font-weight:500; background:rgba(76,175,80,0.1); padding:2px 12px; border-radius:20px; border:1px solid rgba(76,175,80,0.1); display:flex; align-items:center; gap:4px; margin-top:2px;">
                                <i class="fas fa-box" style="font-size:10px;"></i>
                                ${p.totalDisponivel} unidade${p.totalDisponivel > 1 ? 's' : ''} disponíve${p.totalDisponivel > 1 ? 'is' : 'l'}
                            </div>
                            
                            <div style="margin-top:10px; width:100%;">
                                <button onclick="window.location.href='editar-produto.html?id=${p.lotes[0].id}'" style="
                                    background: rgba(245, 166, 35, 0.1);
                                    border: 1px solid rgba(245, 166, 35, 0.15);
                                    color: #F5A623;
                                    padding: 4px 16px;
                                    border-radius: 8px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    font-family: 'Inter', sans-serif;
                                    width: 100%;
                                "
                                onmouseover="this.style.background='rgba(245, 166, 35, 0.2)';"
                                onmouseout="this.style.background='rgba(245, 166, 35, 0.1)';"
                                >
                                    <i class="fas fa-edit" style="font-size:11px;"></i> Editar
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        listaDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Erro detalhado:', error);
        document.getElementById('estoqueLista').innerHTML = '❌ Erro ao carregar estoque: ' + error.message;
    }
}
// ============================================================
// ALTERNAR MODO ESTOQUE (VITRINE / INTERNO)
// ============================================================
function toggleModoEstoque() {
    modoInternoAtivo = !modoInternoAtivo;
    const botao = document.getElementById('toggleModoEstoque');
    const texto = document.getElementById('modoTexto');
    
    if (modoInternoAtivo) {
        botao.style.background = 'rgba(76, 175, 80, 0.1)';
        botao.style.borderColor = 'rgba(76, 175, 80, 0.2)';
        botao.innerHTML = '<i class="fas fa-eye-slash"></i> <span id="modoTexto">Modo Vitrine</span>';
    } else {
        botao.style.background = 'rgba(245,166,35,0.1)';
        botao.style.borderColor = 'rgba(245,166,35,0.2)';
        botao.innerHTML = '<i class="fas fa-eye"></i> <span id="modoTexto">Modo Interno</span>';
    }
    
    carregarEstoqueLotes();
}
// ============================================================
// PREENCHER FILTROS DO ESTOQUE
// ============================================================
function preencherFiltros(snapshot) {
    const marcas = new Set();
    const familias = new Set();
    
    snapshot.forEach(doc => {
        const l = doc.data();
        const saldo = l.quantidade - l.vendido;
        if (saldo > 0) {
            if (l.marca) marcas.add(l.marca);
            if (l.familia) familias.add(l.familia);
        }
    });
    
    const selectMarca = document.getElementById('filtroMarca');
    if (selectMarca && selectMarca.options.length <= 1) {
        const marcasArray = Array.from(marcas).sort();
        marcasArray.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = marca;
            selectMarca.appendChild(option);
        });
    }
    
    const selectFamilia = document.getElementById('filtroFamilia');
    if (selectFamilia && selectFamilia.options.length <= 1) {
        const familiasArray = Array.from(familias).sort();
        familiasArray.forEach(familia => {
            const option = document.createElement('option');
            option.value = familia;
            option.textContent = familia;
            selectFamilia.appendChild(option);
        });
    }
}

// ============================================================
// SELECTS DE PRODUTOS
// ============================================================
async function carregarSelectProdutos() {
    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'lotes'));
        
        const produtos = {};
        snapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo <= 0) return;
            
            const chave = `${l.produto}|${l.marca}|${l.sabor}|${l.peso}`;
            if (!produtos[chave]) {
                produtos[chave] = {
                    nome: l.produto,
                    marca: l.marca,
                    sabor: l.sabor,
                    peso: l.peso,
                    totalSaldo: 0
                };
            }
            produtos[chave].totalSaldo += saldo;
        });
        
        const selectVenda = document.getElementById('produtoVenda');
        const selectPerda = document.getElementById('produtoPerda');
        
        if (selectVenda) {
            selectVenda.innerHTML = '';
            const optionDefault = document.createElement('option');
            optionDefault.value = '';
            optionDefault.textContent = '🔽 Selecione um produto';  // ← SEM HTML, TEXTO PURO
            selectVenda.appendChild(optionDefault);
            
            for (const chave in produtos) {
                const p = produtos[chave];
                const option = document.createElement('option');
                option.value = p.nome;
                option.textContent = `${p.marca} - ${p.nome} (${p.peso}) - ${p.sabor} - Estoque: ${p.totalSaldo}`;
                selectVenda.appendChild(option);
            }
        }
        
        if (selectPerda) {
            selectPerda.innerHTML = '';
            const optionDefault = document.createElement('option');
            optionDefault.value = '';
            optionDefault.textContent = '🔽 Selecione um produto';
            selectPerda.appendChild(optionDefault);
            
            const lotesSnapshot = await window.getDocs(window.collection(window.db, 'lotes'));
            lotesSnapshot.forEach(doc => {
                const l = doc.data();
                const saldo = l.quantidade - l.vendido;
                if (saldo > 0) {
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = `${l.marca} - ${l.produto} (${l.peso}) - ${l.sabor} - Saldo: ${saldo}`;
                    selectPerda.appendChild(option);
                }
            });
        }
        
        console.log('✅ Dropdowns atualizados com sucesso!');
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}
// ============================================================
// GERENCIAR MARCAS
// ============================================================
async function carregarMarcas() {
    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'marcas'));
        const listaDiv = document.getElementById('marcasLista');
        if (!listaDiv) return;
        
        if (snapshot.empty) {
            listaDiv.innerHTML = '<p>Nenhuma marca cadastrada.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const m = doc.data();
            html += `
                <div class="item-estoque" style="display:flex; align-items:center; gap:15px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:8px;">
                    <div style="width:50px; height:50px; background:rgba(255,255,255,0.05); border-radius:8px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                        ${m.logoUrl ? 
                            `<img src="${m.logoUrl}" alt="${m.nome}" style="width:100%; height:100%; object-fit:contain;">` :
                            `<span style="color:#666;"><i class="fas fa-tag"></i></span>`
                        }
                    </div>
                    <div style="flex:1;">
                        <strong>${m.nome}</strong>
                    </div>
                    <div>
                        <button onclick="excluirMarca('${doc.id}')" style="background:#f44336; border:none; border-radius:5px; color:white; padding:4px 12px; cursor:pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        listaDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar marcas:', error);
    }
}

async function salvarMarca(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('🚀 FUNÇÃO salvarMarca FOI CHAMADA!');
    
    const nomeInput = document.getElementById('marcaNome');
    const logoInput = document.getElementById('marcaLogo');
    const messageDiv = document.getElementById('marcaMessage');
    
    if (!nomeInput || !logoInput) {
        console.error('❌ Campos do formulário não encontrados!');
        if (messageDiv) {
            messageDiv.innerHTML = '❌ Erro: formulário não carregado corretamente.';
            messageDiv.className = 'message erro';
        }
        return;
    }
    
    const nome = nomeInput.value.trim().toUpperCase();
    const logoUrl = logoInput.value.trim();
    
    console.log('📝 Nome digitado:', nome);
    console.log('📝 Logo URL digitada:', logoUrl);
    
    if (!nome) {
        mostrarNotificacao('Digite o nome da marca.', 'erro');
        return;
    }
    
    if (!logoUrl) {
        mostrarNotificacao('Digite a URL do logo.', 'erro');
        return;
    }
    
    try {
        console.log('📤 Tentando salvar no Firebase...');
        
        const q = window.query(
            window.collection(window.db, 'marcas'),
            window.where('nome', '==', nome)
        );
        const snapshot = await window.getDocs(q);
        
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            console.log('🔄 Atualizando marca existente:', docRef.id);
            await window.updateDoc(docRef, { logoUrl: logoUrl });
            mostrarNotificacao(`Logo da marca "${nome}" atualizado!`, 'sucesso');
        } else {
            console.log('➕ Criando nova marca...');
            const docRef = await window.addDoc(window.collection(window.db, 'marcas'), {
                nome: nome,
                logoUrl: logoUrl
            });
            console.log('✅ Documento criado com ID:', docRef.id);
            mostrarNotificacao(`Marca "${nome}" adicionada!`, 'sucesso');
        }
        
        nomeInput.value = '';
        logoInput.value = '';
        
        console.log('🔄 Recarregando listas...');
        await carregarMarcas();
        await carregarEstoqueLotes();
        
        console.log('✅ Processo concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ ERRO AO SALVAR:', error);
        mostrarNotificacao(`Erro ao salvar marca: ${error.message}`, 'erro');
    }
}

async function excluirMarca(marcaId) {
    if (!confirm('Tem certeza que deseja excluir esta marca?')) return;
    
    try {
        await window.deleteDoc(window.doc(window.db, 'marcas', marcaId));
        carregarMarcas();
        carregarEstoqueLotes();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        mostrarNotificacao(`Erro ao excluir marca: ${error.message}`, 'erro');
    }
}

// ============================================================
// HISTÓRICO DE VENDAS
// ============================================================
async function carregarHistoricoVendas() {
    const listaDiv = document.getElementById('historicoLista');
    if (!listaDiv) return;
    
    listaDiv.innerHTML = '<p>⏳ Carregando...</p>';
    
    try {
        const periodo = document.getElementById('filtroPeriodoHistorico')?.value || 'todos';
        const clienteFiltro = document.getElementById('filtroClienteHistorico')?.value.toLowerCase().trim() || '';
        
        const agora = new Date();
        let dataInicio = new Date(2020, 0, 1);
        
        if (periodo === 'hoje') {
            dataInicio = new Date();
            dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'semana') {
            dataInicio = new Date();
            dataInicio.setDate(agora.getDate() - 7);
            dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'mes') {
            dataInicio = new Date();
            dataInicio.setMonth(agora.getMonth() - 1);
            dataInicio.setHours(0, 0, 0, 0);
        }
        
        const dataInicioStr = dataInicio.toISOString();
        
        const q = window.query(
            window.collection(window.db, 'vendas'),
            window.where('data', '>=', dataInicioStr)
        );
        const snapshot = await window.getDocs(q);
        
        if (snapshot.empty) {
            listaDiv.innerHTML = '<p><i class="fas fa-inbox"></i> Nenhuma venda registrada neste período.</p>';
            return;
        }
        
        let vendas = [];
        snapshot.forEach(doc => {
            const v = doc.data();
            v.id = doc.id;
            vendas.push(v);
        });
        
        vendas.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        if (clienteFiltro) {
            vendas = vendas.filter(v => v.cliente?.toLowerCase().includes(clienteFiltro));
        }
        
        if (vendas.length === 0) {
            listaDiv.innerHTML = '<p><i class="fas fa-search"></i> Nenhuma venda encontrada com os filtros selecionados.</p>';
            return;
        }
        
        let html = `<div style="display:grid; gap:12px;">`;
        
        vendas.forEach(v => {
            const data = new Date(v.data).toLocaleDateString('pt-BR');
            const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:15px; border-left:4px solid ${v.cancelada ? '#f44336' : '#F5A623'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <strong>${v.produto}</strong>
                            <span style="color:#aaa; font-size:14px; margin-left:10px;">${v.quantidade} un.</span>
                            <span style="color:#aaa; font-size:14px; margin-left:10px;">${v.pagamento}${v.parcelas > 1 ? ` ${v.parcelas}x` : ''}</span>
                            ${v.cancelada ? '<span style="color:#f44336; font-size:12px; margin-left:10px;"><i class="fas fa-ban"></i> CANCELADA</span>' : ''}
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; font-size:18px; color:${v.cancelada ? '#f44336' : '#4caf50'};">R$ ${v.valorTotal.toFixed(2)}</div>
                            <div style="font-size:12px; color:#aaa;">${data} ${hora}</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:14px; color:#aaa;">
                            <i class="fas fa-user"></i> ${v.cliente || 'Cliente não identificado'}
                            ${v.contato ? `<i class="fas fa-phone" style="margin-left:10px;"></i> ${v.contato}` : ''}
                        </div>
                        ${!v.cancelada ? `
                        <div style="display:flex; gap:8px;">
                            <button onclick="window.editarVenda('${v.id}')" style="padding:4px 12px; background:#F5A623; border:none; border-radius:5px; color:white; cursor:pointer; font-size:12px;">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button onclick="window.cancelarVenda('${v.id}')" style="padding:4px 12px; background:#f44336; border:none; border-radius:5px; color:white; cursor:pointer; font-size:12px;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        listaDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        listaDiv.innerHTML = '❌ Erro ao carregar histórico de vendas.';
    }
}

// ============================================================
// RELATÓRIOS
// ============================================================
async function carregarRelatorio() {
    const periodo = document.getElementById('periodoRelatorio')?.value || 'dia';
    const relatorioDiv = document.getElementById('relatorioDados');
    
    if (!relatorioDiv) return;
    
    relatorioDiv.innerHTML = '<p>⏳ Carregando...</p>';
    
    try {
        const agora = new Date();
        let dataInicio = new Date();
        
        if (periodo === 'dia') {
            dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'semana') {
            dataInicio.setDate(agora.getDate() - 7);
            dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'mes') {
            dataInicio.setMonth(agora.getMonth() - 1);
            dataInicio.setHours(0, 0, 0, 0);
        } else if (periodo === 'todos') {
            dataInicio = new Date(2020, 0, 1);
        }
        
        const dataInicioStr = dataInicio.toISOString();
        
        const vendasQuery = window.query(
            window.collection(window.db, 'vendas'),
            window.where('data', '>=', dataInicioStr)
        );
        const vendasSnapshot = await window.getDocs(vendasQuery);
        
        let faturamentoBruto = 0;
        let custoTotalVendido = 0;
        let totalVendas = 0;
        let lucroTotal = 0;
        let vendasPorPagamento = { Pix: 0, Dinheiro: 0, Débito: 0, Crédito: 0 };
        let vendasCanceladas = 0;
        
        vendasSnapshot.forEach(doc => {
            const v = doc.data();
            
            if (v.cancelada === true) {
                vendasCanceladas++;
                return;
            }
            
            faturamentoBruto += v.valorTotal || 0;
            custoTotalVendido += v.custoTotal || 0;
            totalVendas++;
            lucroTotal += v.lucro || 0;
            if (v.pagamento && vendasPorPagamento[v.pagamento] !== undefined) {
                vendasPorPagamento[v.pagamento] += v.valorTotal || 0;
            }
        });
        
        const comprasQuery = window.query(
            window.collection(window.db, 'compras'),
            window.where('dataCompra', '>=', dataInicioStr)
        );
        const comprasSnapshot = await window.getDocs(comprasQuery);
        
        let totalInvestidoPeriodo = 0;
        let investimentoPorSocio = { Mateus: 0, Jonathan: 0 };
        
        comprasSnapshot.forEach(doc => {
            const c = doc.data();
            totalInvestidoPeriodo += c.valorTotal || 0;
            if (c.socio && investimentoPorSocio[c.socio] !== undefined) {
                investimentoPorSocio[c.socio] += c.valorTotal || 0;
            }
        });
        
        const perdasQuery = window.query(
            window.collection(window.db, 'perdas'),
            window.where('data', '>=', dataInicioStr)
        );
        const perdasSnapshot = await window.getDocs(perdasQuery);
        let totalPerdas = 0;
        perdasSnapshot.forEach(doc => {
            const p = doc.data();
            totalPerdas += p.valorTotal || 0;
        });
        
        const lotesSnapshot = await window.getDocs(window.collection(window.db, 'lotes'));
        let valorEstoque = 0;
        let totalUnidadesEstoque = 0;
        let lotesAtivos = 0;
        
        lotesSnapshot.forEach(doc => {
            const l = doc.data();
            const saldo = l.quantidade - l.vendido;
            if (saldo > 0) {
                valorEstoque += saldo * l.custoUnitario;
                totalUnidadesEstoque += saldo;
                lotesAtivos++;
            }
        });
        
        const margem = faturamentoBruto > 0 ? (lucroTotal / faturamentoBruto) * 100 : 0;
        
        const periodos = {
            'dia': 'Hoje',
            'semana': 'Esta semana',
            'mes': 'Este mês',
            'todos': 'Todos os períodos'
        };
        
        relatorioDiv.innerHTML = `
            <h3 style="margin-bottom:15px;"><i class="fas fa-chart-bar"></i> ${periodos[periodo] || periodo}</h3>
            
            ${vendasCanceladas > 0 ? `<p style="color:#ff9800; font-size:14px;"><i class="fas fa-exclamation-triangle"></i> ${vendasCanceladas} venda(s) cancelada(s) foram ignoradas neste relatório.</p>` : ''}
            
            <div class="relatorio-card">
                <div class="card">
                    <h3><i class="fas fa-money-bill-wave"></i> Faturamento Bruto</h3>
                    <div class="valor">R$ ${faturamentoBruto.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-box"></i> Custo das Vendas (FIFO)</h3>
                    <div class="valor">R$ ${custoTotalVendido.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-coins"></i> Lucro Líquido</h3>
                    <div class="valor ${lucroTotal < 0 ? 'vermelho' : ''}">R$ ${lucroTotal.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-chart-line"></i> Margem de Lucro</h3>
                    <div class="valor">${margem.toFixed(1)}%</div>
                </div>
            </div>
            
            <div class="relatorio-card">
                <div class="card">
                    <h3><i class="fas fa-shopping-cart"></i> Total de Vendas</h3>
                    <div class="valor">${totalVendas}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-hand-holding-usd"></i> Total Investido</h3>
                    <div class="valor">R$ ${totalInvestidoPeriodo.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-trash-alt"></i> Perdas</h3>
                    <div class="valor vermelho">R$ ${totalPerdas.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-warehouse"></i> Estoque (valor)</h3>
                    <div class="valor">R$ ${valorEstoque.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="relatorio-card">
                <div class="card">
                    <h3><i class="fas fa-cubes"></i> Estoque (unidades)</h3>
                    <div class="valor">${totalUnidadesEstoque}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-tags"></i> Lotes ativos</h3>
                    <div class="valor">${lotesAtivos}</div>
                </div>
            </div>
            
            <div style="margin-top:20px;">
                <h4><i class="fas fa-users"></i> Investimento por Sócio</h4>
                <ul style="margin-top:10px; list-style:none;">
                    <li><i class="fas fa-user"></i> Mateus: R$ ${investimentoPorSocio.Mateus.toFixed(2)}</li>
                    <li><i class="fas fa-user"></i> Jonathan: R$ ${investimentoPorSocio.Jonathan.toFixed(2)}</li>
                </ul>
            </div>
            
            <div style="margin-top:20px;">
                <h4><i class="fas fa-credit-card"></i> Vendas por meio de pagamento</h4>
                <ul style="margin-top:10px; list-style:none;">
                    <li><i class="fas fa-qrcode"></i> Pix: R$ ${vendasPorPagamento.Pix.toFixed(2)}</li>
                    <li><i class="fas fa-money-bill"></i> Dinheiro: R$ ${vendasPorPagamento.Dinheiro.toFixed(2)}</li>
                    <li><i class="fas fa-credit-card"></i> Débito: R$ ${vendasPorPagamento.Débito.toFixed(2)}</li>
                    <li><i class="fas fa-credit-card"></i> Crédito: R$ ${vendasPorPagamento.Crédito.toFixed(2)}</li>
                </ul>
            </div>
        `;
        
    } catch (error) {
        console.error('Erro:', error);
        relatorioDiv.innerHTML = `❌ Erro ao carregar relatório: ${error.message}`;
    }
}

// ============================================================
// HISTÓRICO DE VENDAS - FUNÇÕES GLOBAIS (para onclick)
// ============================================================
window.editarVenda = function(vendaId) {
    window.location.href = `editar-venda.html?id=${vendaId}`;
};

window.cancelarVenda = async function(vendaId) {
    if (!confirm('⚠️ Tem certeza que deseja CANCELAR esta venda?\n\nOs produtos serão devolvidos ao estoque.\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        const docSnap = await window.getDoc(docRef);
        
        if (!docSnap.exists()) {
            mostrarNotificacao('Venda não encontrada!', 'erro');
            return;
        }
        
        const venda = docSnap.data();
        
        const cancelamento = {
            vendaId: vendaId,
            produto: venda.produto,
            quantidade: venda.quantidade,
            valorTotal: venda.valorTotal,
            motivo: 'Cancelamento pelo vendedor',
            dataOriginal: venda.data,
            dataCancelamento: new Date().toISOString(),
            canceladoPor: currentUser?.email || 'desconhecido'
        };
        
        await window.addDoc(window.collection(window.db, 'cancelamentos_vendas'), cancelamento);
        
        if (venda.lotesUtilizados && venda.lotesUtilizados.length > 0) {
            for (const lote of venda.lotesUtilizados) {
                const loteRef = window.doc(window.db, 'lotes', lote.loteId);
                const loteSnap = await window.getDoc(loteRef);
                if (loteSnap.exists()) {
                    const loteData = loteSnap.data();
                    const novoVendido = Math.max(0, loteData.vendido - lote.quantidade);
                    await window.updateDoc(loteRef, {
                        vendido: novoVendido,
                        ativo: novoVendido < loteData.quantidade
                    });
                }
            }
        }
        
        await window.updateDoc(docRef, { cancelada: true });
        
        mostrarNotificacao('Venda cancelada! Produtos devolvidos ao estoque.', 'aviso');
        carregarHistoricoVendas();
        carregarEstoqueLotes();
        carregarSelectProdutos();
        carregarRelatorio();
        
    } catch (error) {
        console.error('Erro ao cancelar venda:', error);
        mostrarNotificacao(`Erro ao cancelar venda: ${error.message}`, 'erro');
    }
};

// ============================================================
// SISTEMA DE NOTIFICAÇÕES (TOAST)
// ============================================================
function mostrarNotificacao(mensagem, tipo = 'sucesso', duracao = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    const icones = {
        sucesso: '<i class="fas fa-check-circle" style="font-size:20px;"></i>',
        erro: '<i class="fas fa-exclamation-circle" style="font-size:20px;"></i>',
        aviso: '<i class="fas fa-triangle-exclamation" style="font-size:20px;"></i>',
        info: '<i class="fas fa-info-circle" style="font-size:20px;"></i>'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icones[tipo] || icones.info}</span>
        <span>${mensagem}</span>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('removendo');
        setTimeout(() => toast.remove(), 300);
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('removendo');
            setTimeout(() => toast.remove(), 300);
        }
    }, duracao);
}