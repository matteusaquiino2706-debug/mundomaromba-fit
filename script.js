// ============================================================
// MUNDO MAROMBA FIT - SISTEMA DE LOTES (FIFO)
// ============================================================

// Variáveis globais
let currentUser = null;
let precoSugeridoAtualVenda = null;
let bloqueandoAtualizacaoDesconto = false;
let produtosCompraCache = {};
let produtosVendaCache = [];
const MARGEM_PADRAO_COMPRA = 0.4;
let valorSugeridoAutomaticoCompra = '';
let historicoTipoAtual = 'vendas';

// ============================================================
// TABELA DE TAXAS DA MAQUINETA
// ============================================================
const TAXAS_MAQUINETA = {
    debito: 0.0087,
    credito_1x: 0.0308,
    credito_2x: 0.0579,
    credito_3x: 0.0659,
    credito_4x: 0.0839,
    credito_5x: 0.0859,
    credito_6x: 0.0869
};

// ============================================================
// HELPERS DE PRODUTO, PREÇO E TAXAS
// ============================================================
function normalizarTextoProduto(valor) {
    return (valor || '').trim();
}

function criarChaveProduto(produto, marca, sabor, peso) {
    return [
        normalizarTextoProduto(produto),
        normalizarTextoProduto(marca),
        normalizarTextoProduto(sabor || 'Sem sabor'),
        normalizarTextoProduto(peso)
    ].join('|||');
}

function criarChaveProdutoDoLote(lote) {
    return criarChaveProduto(lote.produto, lote.marca, lote.sabor, lote.peso);
}

function decodificarChaveProduto(chave) {
    const [produto = '', marca = '', sabor = '', peso = ''] = (chave || '').split('|||');
    return { produto, marca, sabor, peso };
}

function loteCorrespondeProduto(lote, produtoSelecionado) {
    return criarChaveProdutoDoLote(lote) === criarChaveProduto(
        produtoSelecionado.produto,
        produtoSelecionado.marca,
        produtoSelecionado.sabor,
        produtoSelecionado.peso
    );
}

function obterProdutoSelecionadoVenda() {
    const chave = document.getElementById('produtoVenda')?.value || '';
    if (!chave) return null;
    return decodificarChaveProduto(chave);
}

function calcularTaxaPagamento(pagamento, parcelas) {
    if (pagamento === 'Débito') {
        return { taxa: TAXAS_MAQUINETA.debito, taxaLabel: '0,87%' };
    }

    if (pagamento === 'Crédito') {
        const parcelasValidas = Math.min(Math.max(parseInt(parcelas) || 1, 1), 6);
        const key = `credito_${parcelasValidas}x`;
        const taxa = TAXAS_MAQUINETA[key] || 0;
        return { taxa, taxaLabel: `${(taxa * 100).toFixed(2).replace('.', ',')}%` };
    }

    return { taxa: 0, taxaLabel: '0%' };
}

function converterNumero(valor) {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    if (typeof valor !== 'string') return 0;

    const limpo = valor.replace(/[^\d,.-]/g, '').trim();
    if (!limpo) return 0;

    const normalizado = limpo.includes(',')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo;
    const numero = parseFloat(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}

function calcularSaldoLote(lote) {
    const quantidade = converterNumero(lote?.quantidade);
    const vendido = converterNumero(lote?.vendido);
    return Math.max(0, quantidade - vendido);
}

function converterData(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    if (typeof valor.toDate === 'function') return valor.toDate();

    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [ano, mes, dia] = valor.split('-').map(Number);
        return new Date(ano, mes - 1, dia);
    }

    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
}

function dentroDoPeriodo(dataValor, dataInicio, periodo) {
    if (periodo === 'todos') return true;

    const data = converterData(dataValor);
    if (!data) return false;

    return data >= dataInicio;
}

function normalizarFormaPagamento(valor) {
    const texto = (valor || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (texto.includes('pix')) return 'Pix';
    if (texto.includes('dinheiro')) return 'Dinheiro';
    if (texto.includes('debito')) return 'Débito';
    if (texto.includes('credito')) return 'Crédito';
    return valor;
}

function normalizarComparacao(valor) {
    return (valor || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function formatarMoeda(valor) {
    return (converterNumero(valor)).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarPercentual(valor) {
    return `${converterNumero(valor).toFixed(1).replace('.', ',')}%`;
}

function formatarDataCurta(valor) {
    const data = converterData(valor);
    if (!data) return '-';
    return data.toLocaleDateString('pt-BR');
}

function obterDataInputHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function escaparHtml(valor) {
    const div = document.createElement('div');
    div.textContent = valor ?? '';
    return div.innerHTML;
}

function obterIniciaisProduto(produto, marca) {
    const texto = `${marca || ''} ${produto || ''}`.trim();
    if (!texto) return 'MM';

    return texto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte[0])
        .join('')
        .toUpperCase();
}

function renderizarFallbackProduto(produto, marca, compacto = false) {
    return `
        <div class="product-fallback">
            <div class="initials">${escaparHtml(obterIniciaisProduto(produto, marca))}</div>
            <div class="fallback-text">${escaparHtml(produto || 'Produto')}</div>
            ${compacto ? '' : `<div style="font-size:10px; color:#aaa;">${escaparHtml(marca || 'Mundo Maromba')}</div>`}
        </div>
    `;
}

function renderizarImagemProduto(produto, marca, imagemUrl, compacto = false) {
    if (imagemUrl && imagemUrl.trim() !== '') {
        return `
            <img src="${escaparHtml(imagemUrl)}" alt="${escaparHtml(produto)}" style="width:100%; height:100%; object-fit:contain; padding:${compacto ? '4px' : '6px'};" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display:none; width:100%; height:100%;">${renderizarFallbackProduto(produto, marca, compacto)}</div>
        `;
    }

    return renderizarFallbackProduto(produto, marca, compacto);
}

function renderizarLogoMarca(marca, logoUrl, tamanho = '24px') {
    if (logoUrl && logoUrl.trim() !== '') {
        return `<img src="${escaparHtml(logoUrl)}" alt="${escaparHtml(marca)}" style="width:${tamanho}; height:${tamanho}; object-fit:contain; border-radius:6px;">`;
    }

    return `<span style="width:${tamanho}; height:${tamanho}; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; background:rgba(245,166,35,0.1); color:#F5A623; font-size:11px; font-weight:800;">${escaparHtml(obterIniciaisProduto('', marca).slice(0, 2))}</span>`;
}

function atualizarPreviewImagemProduto() {
    const preview = document.getElementById('imagemProdutoPreview');
    if (!preview) return;

    const url = document.getElementById('imagemProduto')?.value.trim();
    const produto = document.getElementById('nome')?.value.trim();
    const marca = document.getElementById('marca')?.value.trim();

    preview.innerHTML = renderizarImagemProduto(produto, marca, url, false);
}

function montarConsultaImagemProduto() {
    const sabor = document.getElementById('sabor')?.value;

    return [
        document.getElementById('marca')?.value,
        document.getElementById('nome')?.value,
        document.getElementById('peso')?.value,
        normalizarComparacao(sabor) === 'sem sabor' ? '' : sabor,
        'suplemento embalagem'
    ].filter(Boolean).join(' ').trim();
}

function definirStatusBuscaImagem(texto, tipo = 'info') {
    const status = document.getElementById('imagemBuscaStatus');
    if (!status) return;

    const cores = {
        info: '#888',
        sucesso: '#4caf50',
        erro: '#ff6b6b',
        aviso: '#F5A623'
    };
    status.textContent = texto;
    status.style.color = cores[tipo] || cores.info;
}

function selecionarImagemProduto(url) {
    const input = document.getElementById('imagemProduto');
    if (input) input.value = url || '';
    atualizarPreviewImagemProduto();
    definirStatusBuscaImagem('Imagem selecionada para este lote.', 'sucesso');
}

async function buscarImagemProdutoOnline() {
    const consulta = montarConsultaImagemProduto();
    const sugestoes = document.getElementById('imagemSugestoes');

    if (!consulta || consulta.length < 4) {
        definirStatusBuscaImagem('Preencha marca e nome do produto para buscar.', 'aviso');
        return;
    }

    if (sugestoes) sugestoes.innerHTML = '';
    definirStatusBuscaImagem('Buscando imagem real do produto...', 'info');

    try {
        const resposta = await fetch(`/.netlify/functions/buscar-imagens?q=${encodeURIComponent(consulta)}`);
        if (!resposta.ok) {
            throw new Error('Busca online ainda não conectada.');
        }

        const dados = await resposta.json();
        const imagens = Array.isArray(dados.imagens) ? dados.imagens : [];

        if (imagens.length === 0) {
            definirStatusBuscaImagem('Nenhuma imagem encontrada para esse produto.', 'aviso');
            return;
        }

        if (sugestoes) {
            const imagensExibidas = imagens.slice(0, 6);
            sugestoes.innerHTML = imagensExibidas.map((img, index) => `
                <button type="button" class="image-result" data-image-index="${index}">
                    <img src="${escaparHtml(img.thumbnail || img.url)}" alt="${escaparHtml(img.titulo || 'Imagem do produto')}">
                </button>
            `).join('');

            sugestoes.querySelectorAll('.image-result').forEach(botao => {
                botao.addEventListener('click', () => {
                    const index = parseInt(botao.dataset.imageIndex, 10);
                    selecionarImagemProduto(imagensExibidas[index]?.url || '');
                });
            });
        }

        definirStatusBuscaImagem('Escolha uma das imagens encontradas.', 'sucesso');
    } catch (error) {
        console.warn('Busca online de imagem indisponível:', error);
        definirStatusBuscaImagem('Busca automática indisponível agora. Tente novamente em instantes.', 'aviso');
        mostrarNotificacao('Não foi possível buscar imagens online agora.', 'aviso');
    }
}

window.selecionarImagemProduto = selecionarImagemProduto;

function vendaCorrespondeProduto(venda, produtoSelecionado) {
    if (!produtoSelecionado) return false;

    const chaveAtual = criarChaveProduto(
        produtoSelecionado.produto,
        produtoSelecionado.marca,
        produtoSelecionado.sabor,
        produtoSelecionado.peso
    );

    if (venda.produtoChave) {
        return venda.produtoChave === chaveAtual;
    }

    const mesmoProduto = normalizarComparacao(venda.produto) === normalizarComparacao(produtoSelecionado.produto);
    const mesmaMarca = !venda.marca || normalizarComparacao(venda.marca) === normalizarComparacao(produtoSelecionado.marca);
    const mesmoSabor = !venda.sabor || normalizarComparacao(venda.sabor) === normalizarComparacao(produtoSelecionado.sabor);
    const mesmoPeso = !venda.peso || normalizarComparacao(venda.peso) === normalizarComparacao(produtoSelecionado.peso);

    return mesmoProduto && mesmaMarca && mesmoSabor && mesmoPeso;
}

async function buscarLotesDisponiveisPorProduto(produtoSelecionado) {
    if (!produtoSelecionado?.produto) return [];

    const q = window.query(
        window.collection(window.db, 'lotes'),
        window.where('produto', '==', produtoSelecionado.produto)
    );
    const snapshot = await window.getDocs(q);
    const lotes = [];

    snapshot.forEach(docSnap => {
        const lote = docSnap.data();
        const saldo = calcularSaldoLote(lote);
        if (saldo > 0 && lote.ativo !== false && loteCorrespondeProduto(lote, produtoSelecionado)) {
            lotes.push({
                id: docSnap.id,
                ref: docSnap.ref,
                ...lote,
                saldo
            });
        }
    });

    return lotes.sort((a, b) => new Date(a.dataCompra) - new Date(b.dataCompra));
}

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
        document.getElementById('despesaForm')?.addEventListener('submit', registrarDespesa);
        document.getElementById('caixaForm')?.addEventListener('submit', registrarMovimentoCaixa);
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
        document.getElementById('valorSugerido')?.addEventListener('input', atualizarResumoCompra);
        document.getElementById('marca')?.addEventListener('input', atualizarPreviewImagemProduto);
        document.getElementById('nome')?.addEventListener('input', function() {
            atualizarPreviewImagemProduto();
            atualizarResumoCompra();
        });
        document.getElementById('peso')?.addEventListener('input', atualizarResumoCompra);
        document.getElementById('sabor')?.addEventListener('input', atualizarResumoCompra);
        document.getElementById('buscarImagemProdutoOnline')?.addEventListener('click', buscarImagemProdutoOnline);
        document.getElementById('produtoCompraExistente')?.addEventListener('change', preencherCompraPorProdutoExistente);
        document.getElementById('buscaProdutoVenda')?.addEventListener('input', function() {
            renderizarSelectVenda(this.value);
        });
        configurarAtalhosVenda();

        // Carregar dados iniciais
        carregarSelectProdutos();
        carregarEstoqueLotes();
        carregarRelatorio();
        definirDataDespesaPadrao();
        definirDataCompraPadrao();
        definirSaborCompraPadrao();
        definirDataCaixaPadrao();
        atualizarResumoCompra();
        atualizarPreviewImagemProduto();
        carregarDespesas();
        carregarCaixa();
        carregarProdutosCompraRapida();

        // Recalcular quando o valor total for alterado manualmente
        document.getElementById('previewTotal')?.addEventListener('input', function() {
            const valorTotal = converterNumero(this.value);
            const quantidade = parseInt(document.getElementById('quantidadeVenda').value) || 1;
            const pagamento = document.getElementById('pagamentoVenda')?.value;
            const parcelas = parseInt(document.getElementById('parcelasVenda')?.value) || 1;
            const { taxa } = calcularTaxaPagamento(pagamento, parcelas);
            const valorBase = repasseJurosAtivo() && taxa > 0 ? valorTotal * (1 - taxa) : valorTotal;
            if (valorTotal > 0 && quantidade > 0) {
                document.getElementById('precoVenda').value = (valorBase / quantidade).toFixed(2).replace('.', ',');
                atualizarCamposDesconto();
            }
            calcularPreview();
        });

        document.getElementById('quantidadeVenda')?.addEventListener('input', function() {
            atualizarAtalhosQuantidade();
            atualizarTotalVendaPorPrecoUnitario();
            atualizarCamposDesconto();
            calcularPreview();
        });

        // Eventos do histórico
        configurarHistoricoMovimentacoes();
        document.getElementById('filtroPeriodoHistorico')?.addEventListener('change', carregarHistoricoMovimentacoes);
        document.getElementById('aplicarFiltrosHistorico')?.addEventListener('click', carregarHistoricoMovimentacoes);
        document.getElementById('filtroClienteHistorico')?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') carregarHistoricoMovimentacoes();
        });
        document.getElementById('copiarRelatorioVendasWhatsapp')?.addEventListener('click', () => copiarRelatorioHistoricoWhatsApp('vendas'));
        document.getElementById('copiarRelatorioComprasWhatsapp')?.addEventListener('click', () => copiarRelatorioHistoricoWhatsApp('compras'));

        // Eventos para calcular preview
        document.getElementById('pagamentoVenda')?.addEventListener('change', function() {
            toggleParcelas();
            atualizarAtalhosPagamento();
            atualizarTotalVendaPorPrecoUnitario();
            calcularPreview();
        });
        document.getElementById('parcelasVenda')?.addEventListener('change', function() {
            atualizarTotalVendaPorPrecoUnitario();
            calcularPreview();
        });
        document.getElementById('repasseJuros')?.addEventListener('change', function() {
            atualizarTotalVendaPorPrecoUnitario();
            calcularPreview();
        });
        document.getElementById('precoVenda')?.addEventListener('input', function() {
            atualizarTotalVendaPorPrecoUnitario();
            atualizarCamposDesconto();
            calcularPreview();
        });
        document.getElementById('precoVenda')?.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
            }
        });
        document.getElementById('descontoValor')?.addEventListener('input', aplicarDescontoPorValor);
        document.getElementById('descontoPercentual')?.addEventListener('input', aplicarDescontoPorPercentual);

        // Eventos dos filtros do estoque
        document.getElementById('filtroMarca')?.addEventListener('change', carregarEstoqueLotes);
        document.getElementById('filtroFamilia')?.addEventListener('change', carregarEstoqueLotes);
        document.getElementById('filtroBuscaEstoque')?.addEventListener('input', carregarEstoqueLotes);
        document.getElementById('copiarEstoqueWhatsapp')?.addEventListener('click', copiarEstoqueWhatsApp);
        document.getElementById('limparFiltros')?.addEventListener('click', function() {
            document.getElementById('filtroMarca').value = '';
            document.getElementById('filtroFamilia').value = '';
            const buscaEstoque = document.getElementById('filtroBuscaEstoque');
            if (buscaEstoque) buscaEstoque.value = '';
            carregarEstoqueLotes();
        });

        // Evento para buscar informações do produto ao selecionar
        document.getElementById('produtoVenda')?.addEventListener('change', function() {
            buscarInfoProduto();
            preencherPrecoSugerido();
            atualizarResumoVenda();
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
    if (abaId === 'compras') {
        definirDataCompraPadrao();
        definirSaborCompraPadrao();
        carregarProdutosCompraRapida();
        atualizarResumoCompra();
        atualizarPreviewImagemProduto();
    }
    if (abaId === 'vendas') carregarSelectProdutos();
    if (abaId === 'relatorios') carregarRelatorio();
    if (abaId === 'caixa') {
        definirDataCaixaPadrao();
        carregarCaixa();
    }
    if (abaId === 'despesas') {
        definirDataDespesaPadrao();
        carregarDespesas();
    }
    if (abaId === 'marcas') carregarMarcas();
    if (abaId === 'historico') carregarHistoricoMovimentacoes();
}

// ============================================================
// COMPRAS (CRIA NOVO LOTE)
// ============================================================
function definirDataCompraPadrao() {
    const dataCompra = document.getElementById('dataCompra');
    if (dataCompra && !dataCompra.value) {
        dataCompra.value = obterDataInputHoje();
    }
}

function definirSaborCompraPadrao() {
    const sabor = document.getElementById('sabor');
    if (sabor && !sabor.value.trim()) {
        sabor.value = 'Sem sabor';
    }
}

function formatarValorCampo(valor) {
    return converterNumero(valor).toFixed(2).replace('.', ',');
}

function atualizarTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
}

function aplicarSugestaoAutomaticaCompra(custoUnitario) {
    const campo = document.getElementById('valorSugerido');
    if (!campo) return;

    const sugestao = custoUnitario > 0 ? formatarValorCampo(custoUnitario * (1 + MARGEM_PADRAO_COMPRA)) : '';
    const valorAtual = campo.value.trim();
    const podeAtualizar = !valorAtual || valorAtual === valorSugeridoAutomaticoCompra;

    if (podeAtualizar) {
        campo.value = sugestao;
    }

    valorSugeridoAutomaticoCompra = sugestao;
}

function calcularUnitario() {
    const valorTotal = converterNumero(document.getElementById('valorTotal')?.value);
    const quantidade = parseInt(document.getElementById('quantidadeCompra')?.value) || 1;

    if (valorTotal > 0 && quantidade > 0) {
        const unitario = valorTotal / quantidade;
        document.getElementById('valorUnitario').value = formatarValorCampo(unitario);
        document.getElementById('simulacao40').value = formatarValorCampo(unitario * (1 + MARGEM_PADRAO_COMPRA));
        aplicarSugestaoAutomaticaCompra(unitario);
    } else {
        document.getElementById('valorUnitario').value = '';
        document.getElementById('simulacao40').value = '';
        aplicarSugestaoAutomaticaCompra(0);
    }

    atualizarResumoCompra();
}

function atualizarResumoCompra() {
    const valorTotal = converterNumero(document.getElementById('valorTotal')?.value);
    const quantidade = parseInt(document.getElementById('quantidadeCompra')?.value) || 0;
    const custoUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
    const vendaSugeridaInformada = converterNumero(document.getElementById('valorSugerido')?.value);
    const vendaSugerida = vendaSugeridaInformada || (custoUnitario > 0 ? custoUnitario * (1 + MARGEM_PADRAO_COMPRA) : 0);
    const lucroUnitario = Math.max(0, vendaSugerida - custoUnitario);
    const margem = vendaSugerida > 0 ? (lucroUnitario / vendaSugerida) * 100 : 0;
    const potencial = lucroUnitario * quantidade;

    atualizarTexto('resumoCustoUnitario', formatarMoeda(custoUnitario));
    atualizarTexto('resumoVendaSugerida', vendaSugerida ? formatarMoeda(vendaSugerida) : 'Pendente');
    atualizarTexto('resumoLucroUnitario', formatarMoeda(lucroUnitario));
    atualizarTexto('resumoMargem', `${margem.toFixed(1).replace('.', ',')}%`);
    atualizarTexto('resumoPotencial', formatarMoeda(potencial));

    const status = document.getElementById('compraStatusResumo');
    if (status) {
        const nome = document.getElementById('nome')?.value.trim();
        const peso = document.getElementById('peso')?.value.trim();
        status.textContent = nome ? `${nome}${peso ? ` ${peso}` : ''}` : 'Novo lote';
    }
}

async function carregarProdutosCompraRapida() {
    const select = document.getElementById('produtoCompraExistente');
    if (!select) return;

    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'lotes'));
        produtosCompraCache = {};

        snapshot.forEach(docSnap => {
            const lote = docSnap.data();
            const chave = criarChaveProdutoDoLote(lote);

            if (!produtosCompraCache[chave]) {
                produtosCompraCache[chave] = {
                    produto: lote.produto || '',
                    marca: lote.marca || '',
                    sabor: lote.sabor || 'Sem sabor',
                    peso: lote.peso || '',
                    familia: lote.familia || 'Outros',
                    valorSugerido: null,
                    imagemUrl: '',
                    totalComprado: 0
                };
            }

            produtosCompraCache[chave].totalComprado += converterNumero(lote.quantidade);

            if (converterNumero(lote.valorSugerido) > 0) {
                produtosCompraCache[chave].valorSugerido = converterNumero(lote.valorSugerido);
            }

            if (lote.imagemUrl) {
                produtosCompraCache[chave].imagemUrl = lote.imagemUrl;
            }
        });

        const valorAtual = select.value;
        select.innerHTML = '<option value="">Novo produto ou selecione um existente</option>';

        Object.entries(produtosCompraCache)
            .sort(([, a], [, b]) => `${a.marca} ${a.produto}`.localeCompare(`${b.marca} ${b.produto}`, 'pt-BR'))
            .forEach(([chave, produto]) => {
                const option = document.createElement('option');
                option.value = chave;
                option.textContent = `${produto.marca} - ${produto.produto}${produto.peso ? ` (${produto.peso})` : ''}${produto.sabor && produto.sabor !== 'Sem sabor' ? ` - ${produto.sabor}` : ''}`;
                select.appendChild(option);
            });

        if (produtosCompraCache[valorAtual]) {
            select.value = valorAtual;
        }
    } catch (error) {
        console.error('Erro ao carregar produtos para compra rápida:', error);
    }
}

function preencherCompraPorProdutoExistente() {
    const select = document.getElementById('produtoCompraExistente');
    const produto = produtosCompraCache[select?.value];
    if (!produto) return;

    document.getElementById('marca').value = produto.marca || '';
    document.getElementById('familia').value = produto.familia || 'Outros';
    document.getElementById('nome').value = produto.produto || '';
    document.getElementById('peso').value = produto.peso || '';
    document.getElementById('sabor').value = produto.sabor || 'Sem sabor';
    document.getElementById('valorSugerido').value = produto.valorSugerido ? produto.valorSugerido.toFixed(2).replace('.', ',') : '';
    valorSugeridoAutomaticoCompra = '';
    document.getElementById('imagemProduto').value = produto.imagemUrl || '';

    atualizarResumoCompra();
    atualizarPreviewImagemProduto();
}

async function registrarCompra(event) {
    event.preventDefault();

    try {
        const produtoNome = document.getElementById('nome').value.trim();
        const marcaNome = document.getElementById('marca').value.trim();
        const quantidadeCompra = parseInt(document.getElementById('quantidadeCompra').value);
        const valorTotalCompra = converterNumero(document.getElementById('valorTotal').value);
        const custoUnitario = quantidadeCompra > 0 ? valorTotalCompra / quantidadeCompra : 0;
        const valorSugeridoInformado = converterNumero(document.getElementById('valorSugerido').value) || null;
        const simulacao40 = custoUnitario * (1 + MARGEM_PADRAO_COMPRA);
        const imagemUrl = document.getElementById('imagemProduto')?.value.trim() || '';

        const lote = {
            produto: produtoNome,
            marca: marcaNome,
            sabor: document.getElementById('sabor').value.trim() || 'Sem sabor',
            peso: document.getElementById('peso').value.trim(),
            familia: document.getElementById('familia').value,
            dataCompra: document.getElementById('dataCompra').value,
            quantidade: quantidadeCompra,
            custoUnitario,
            valorTotal: valorTotalCompra,
            valorSugerido: valorSugeridoInformado || simulacao40,
            simulacao40,
            vendido: 0,
            ativo: true,
            dataCriacao: new Date().toISOString(),
            imagemUrl,
        };

        const loteRef = window.doc(window.collection(window.db, 'lotes'));
        const compraRef = window.doc(window.collection(window.db, 'compras'));
        const batch = window.writeBatch(window.db);

        batch.set(loteRef, lote);
        batch.set(compraRef, {
            ...lote,
            loteId: loteRef.id,
            tipo: 'compra'
        });
        await batch.commit();

        mostrarNotificacao(`Lote registrado! ${lote.quantidade} un. a R$ ${lote.custoUnitario.toFixed(2)}`, 'sucesso');
        document.getElementById('compraForm').reset();
        valorSugeridoAutomaticoCompra = '';
        definirDataCompraPadrao();
        definirSaborCompraPadrao();
        atualizarResumoCompra();
        atualizarPreviewImagemProduto();

        carregarEstoqueLotes();
        carregarSelectProdutos();
        carregarProdutosCompraRapida();
        carregarRelatorio();

    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao(`Erro ao registrar compra: ${error.message}`, 'erro');
    }
}

// ============================================================
// VENDAS (FIFO - PRIMEIRO QUE ENTRA, PRIMEIRO QUE SAI)
// ============================================================
function configurarAtalhosVenda() {
    document.querySelectorAll('[data-pagamento-rapido]').forEach(botao => {
        botao.addEventListener('click', () => {
            const pagamento = botao.dataset.pagamentoRapido;
            const select = document.getElementById('pagamentoVenda');
            if (!select || !pagamento) return;

            select.value = pagamento;
            toggleParcelas();
            atualizarAtalhosPagamento();
            atualizarTotalVendaPorPrecoUnitario();
            calcularPreview();
        });
    });

    document.querySelectorAll('[data-qty-step]').forEach(botao => {
        botao.addEventListener('click', () => {
            const passo = parseInt(botao.dataset.qtyStep) || 0;
            const campo = document.getElementById('quantidadeVenda');
            const atual = parseInt(campo?.value) || 1;
            definirQuantidadeVenda(atual + passo);
        });
    });

    document.querySelectorAll('[data-qty-preset]').forEach(botao => {
        botao.addEventListener('click', () => {
            definirQuantidadeVenda(parseInt(botao.dataset.qtyPreset) || 1);
        });
    });

    atualizarAtalhosPagamento();
    atualizarAtalhosQuantidade();
    atualizarResumoVenda();
}

function definirQuantidadeVenda(valor) {
    const campo = document.getElementById('quantidadeVenda');
    if (!campo) return;

    campo.value = String(Math.max(1, parseInt(valor) || 1));
    atualizarAtalhosQuantidade();
    atualizarTotalVendaPorPrecoUnitario();
    atualizarCamposDesconto();
    calcularPreview();
}

function atualizarAtalhosPagamento() {
    const pagamentoAtual = document.getElementById('pagamentoVenda')?.value || 'Pix';
    document.querySelectorAll('[data-pagamento-rapido]').forEach(botao => {
        botao.classList.toggle('active', botao.dataset.pagamentoRapido === pagamentoAtual);
    });
}

function atualizarAtalhosQuantidade() {
    const quantidade = parseInt(document.getElementById('quantidadeVenda')?.value) || 1;
    document.querySelectorAll('[data-qty-preset]').forEach(botao => {
        botao.classList.toggle('active', parseInt(botao.dataset.qtyPreset) === quantidade);
    });
}

function atualizarResumoVenda(dados = {}) {
    const quantidade = parseInt(document.getElementById('quantidadeVenda')?.value) || 1;
    const produtoSelecionado = obterProdutoSelecionadoVenda();
    const precoUnitario = dados.precoUnitario ?? converterNumero(document.getElementById('precoVenda')?.value);
    const pagamento = document.getElementById('pagamentoVenda')?.value || 'Pix';
    const parcelas = parseInt(document.getElementById('parcelasVenda')?.value) || 1;
    const { taxa, taxaLabel } = calcularTaxaPagamento(pagamento, parcelas);
    const valoresVenda = dados.valoresVenda || calcularValoresVenda(precoUnitario * quantidade, taxa, repasseJurosAtivo());
    const desconto = calcularDescontoVendaAtual();

    atualizarTexto('vendaStatusResumo', produtoSelecionado ? `${produtoSelecionado.produto} x${quantidade}` : 'Pronta para venda');
    atualizarTexto('resumoVendaUnitario', precoUnitario > 0 ? formatarMoeda(precoUnitario) : 'Pendente');
    atualizarTexto(
        'resumoVendaDesconto',
        desconto.descontoTotal > 0.004 ? formatarMoeda(desconto.descontoTotal) : 'Sem desconto'
    );
    atualizarTexto(
        'resumoVendaTaxa',
        taxa > 0
            ? (repasseJurosAtivo() ? `${taxaLabel} repassado` : formatarMoeda(valoresVenda.taxaValor))
            : 'Sem taxa'
    );

    if (dados.lucroReal !== undefined) {
        const lucroEl = document.getElementById('previewLucro');
        if (lucroEl) lucroEl.classList.toggle('vermelho', dados.lucroReal < 0);
    }
}

async function registrarVenda(event) {
    event.preventDefault();

    const produtoSelecionado = obterProdutoSelecionadoVenda();
    const quantidadeVenda = parseInt(document.getElementById('quantidadeVenda').value);
    const valorTotalInformado = converterNumero(document.getElementById('previewTotal').value);
    const precoVendaInformado = converterNumero(document.getElementById('precoVenda').value);

    if (!produtoSelecionado) {
        mostrarNotificacao('Selecione um produto!', 'erro');
        return;
    }

    if (!quantidadeVenda || quantidadeVenda <= 0) {
        mostrarNotificacao('Informe uma quantidade válida!', 'erro');
        return;
    }

    const valorBaseVenda = precoVendaInformado > 0
        ? (precoVendaInformado * quantidadeVenda)
        : valorTotalInformado;

    if (!valorBaseVenda || valorBaseVenda <= 0) {
        mostrarNotificacao('Informe o valor da venda.', 'erro');
        return;
    }

    try {
        const candidatos = await buscarLotesDisponiveisPorProduto(produtoSelecionado);
        const totalDisponivel = candidatos.reduce((acc, l) => acc + l.saldo, 0);
        if (totalDisponivel < quantidadeVenda) {
            throw new Error(`Estoque insuficiente! Disponível: ${totalDisponivel} unidades.`);
        }

        const pagamento = document.getElementById('pagamentoVenda').value;
        const parcelas = pagamento === 'Crédito' ? (parseInt(document.getElementById('parcelasVenda').value) || 1) : 1;
        const { taxa } = calcularTaxaPagamento(pagamento, parcelas);
        const repasseJuros = repasseJurosAtivo();
        const valoresVenda = calcularValoresVenda(valorBaseVenda, taxa, repasseJuros);
        const valorTotal = valoresVenda.valorTotal;
        const totalCobradoCliente = valoresVenda.totalCobradoCliente;
        const valorLiquido = valoresVenda.valorLiquido;
        const taxaValorCalculada = valoresVenda.taxaValor;
        const jurosRepassado = valoresVenda.jurosRepassado;
        const precoUnitario = valorBaseVenda / quantidadeVenda;
        const precoUnitarioCobrado = valorTotal / quantidadeVenda;
        const precoReferenciaVenda = converterNumero(precoSugeridoAtualVenda);
        const descontoUnitarioVenda = precoReferenciaVenda > 0
            ? Math.max(0, precoReferenciaVenda - precoUnitario)
            : Math.max(0, converterNumero(document.getElementById('descontoValor')?.value));
        const descontoPercentualVenda = precoReferenciaVenda > 0
            ? (descontoUnitarioVenda / precoReferenciaVenda) * 100
            : Math.max(0, converterNumero(document.getElementById('descontoPercentual')?.value));
        const descontoTotalVenda = descontoUnitarioVenda * quantidadeVenda;

        const resultado = await window.runTransaction(window.db, async (transaction) => {
            const lotesDisponiveis = [];

            for (const candidato of candidatos) {
                const loteSnap = await transaction.get(candidato.ref);
                if (!loteSnap.exists()) continue;

                const lote = loteSnap.data();
                const saldo = calcularSaldoLote(lote);
                if (saldo > 0 && lote.ativo !== false && loteCorrespondeProduto(lote, produtoSelecionado)) {
                    lotesDisponiveis.push({
                        id: loteSnap.id,
                        ref: candidato.ref,
                        ...lote,
                        saldo
                    });
                }
            }

            lotesDisponiveis.sort((a, b) => new Date(a.dataCompra) - new Date(b.dataCompra));

            const saldoAtual = lotesDisponiveis.reduce((acc, l) => acc + l.saldo, 0);
            if (saldoAtual < quantidadeVenda) {
                throw new Error(`Estoque insuficiente! Disponível agora: ${saldoAtual} unidades.`);
            }

            let quantidadeRestante = quantidadeVenda;
            let custoTotal = 0;
            const lotesUtilizados = [];

            for (const lote of lotesDisponiveis) {
                if (quantidadeRestante <= 0) break;

                const usar = Math.min(quantidadeRestante, lote.saldo);
                const custoUnitarioLote = converterNumero(lote.custoUnitario);
                const quantidadeTotalLote = converterNumero(lote.quantidade);
                const vendidoAtualLote = converterNumero(lote.vendido);
                custoTotal += usar * custoUnitarioLote;

                lotesUtilizados.push({
                    loteId: lote.id,
                    quantidade: usar,
                    custoUnitario: custoUnitarioLote,
                    dataCompra: lote.dataCompra
                });

                const novoVendido = vendidoAtualLote + usar;
                transaction.update(lote.ref, {
                    vendido: novoVendido,
                    ativo: novoVendido < quantidadeTotalLote
                });

                quantidadeRestante -= usar;
            }

            const taxaValor = taxaValorCalculada;
            const venda = {
                produto: produtoSelecionado.produto,
                marca: produtoSelecionado.marca,
                sabor: produtoSelecionado.sabor,
                peso: produtoSelecionado.peso,
                produtoChave: criarChaveProduto(
                    produtoSelecionado.produto,
                    produtoSelecionado.marca,
                    produtoSelecionado.sabor,
                    produtoSelecionado.peso
                ),
                quantidade: quantidadeVenda,
                precoUnitario,
                precoUnitarioCobrado,
                precoReferencia: precoReferenciaVenda || null,
                descontoValorUnitario: descontoUnitarioVenda,
                descontoPercentual: descontoPercentualVenda,
                descontoTotal: descontoTotalVenda,
                valorBase: valorBaseVenda,
                valorTotal,
                totalCobradoCliente,
                custoTotal,
                lucroBruto: valorBaseVenda - custoTotal,
                lucro: valorLiquido - custoTotal,
                pagamento,
                parcelas,
                repasseJuros,
                jurosRepassado,
                taxa,
                taxaValor,
                valorLiquido,
                cliente: document.getElementById('clienteVenda').value || 'Cliente não identificado',
                contato: document.getElementById('contatoVenda').value || '',
                data: new Date().toISOString(),
                vendedor: currentUser?.email,
                lotesUtilizados
            };

            const vendaRef = window.doc(window.collection(window.db, 'vendas'));
            transaction.set(vendaRef, venda);
            return venda;
        });

        const totalMensagem = resultado.repasseJuros
            ? `Produto: R$ ${resultado.valorTotal.toFixed(2)} | Cobrar: R$ ${resultado.totalCobradoCliente.toFixed(2)}`
            : `Total: R$ ${resultado.valorTotal.toFixed(2)}`;
        mostrarNotificacao(`Venda registrada! ${quantidadeVenda} un. | ${totalMensagem}`, 'sucesso');
        document.getElementById('vendaForm').reset();
        document.getElementById('quantidadeVenda').value = '1';
        document.getElementById('previewTotal').value = '0';
        document.getElementById('previewLiquido').value = 'R$ 0,00';
        document.getElementById('previewLucro').value = 'R$ 0,00';
        precoSugeridoAtualVenda = null;
        limparCamposDesconto();
        toggleParcelas();
        renderizarSelectVenda('');
        atualizarAtalhosPagamento();
        atualizarAtalhosQuantidade();
        atualizarResumoVenda();

        carregarEstoqueLotes();
        carregarSelectProdutos();
        carregarRelatorio();

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
        await window.runTransaction(window.db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error('Lote não encontrado.');
            }

            const lote = docSnap.data();
            const saldo = calcularSaldoLote(lote);
            const custoUnitario = converterNumero(lote.custoUnitario);
            const quantidadeTotal = converterNumero(lote.quantidade);
            const vendidoAtual = converterNumero(lote.vendido);

            if (saldo < quantidade) {
                throw new Error(`Saldo insuficiente! Disponível: ${saldo} unidades.`);
            }

            const perda = {
                produto: lote.produto,
                marca: lote.marca,
                sabor: lote.sabor,
                peso: lote.peso,
                quantidade: quantidade,
                valorUnitario: custoUnitario,
                valorTotal: custoUnitario * quantidade,
                motivo: motivo,
                data: new Date().toISOString(),
                registradoPor: currentUser?.email,
                loteId: produtoId
            };

            const perdaRef = window.doc(window.collection(window.db, 'perdas'));
            transaction.set(perdaRef, perda);

            const novoVendido = vendidoAtual + quantidade;
            transaction.update(docRef, {
                vendido: novoVendido,
                ativo: novoVendido < quantidadeTotal
            });
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
// DESPESAS
// ============================================================
function definirDataDespesaPadrao() {
    const dataDespesa = document.getElementById('dataDespesa');
    if (dataDespesa && !dataDespesa.value) {
        dataDespesa.value = obterDataInputHoje();
    }
}

function atualizarMensagemDespesa(mensagem = '', tipo = '') {
    const messageDiv = document.getElementById('despesaMessage');
    if (!messageDiv) return;

    messageDiv.textContent = mensagem;
    messageDiv.className = tipo ? `message ${tipo}` : 'message';
}

async function registrarDespesa(event) {
    event.preventDefault();

    const valor = converterNumero(document.getElementById('valorDespesa')?.value);
    const descricao = document.getElementById('descricaoDespesa')?.value.trim();
    const dataDespesa = document.getElementById('dataDespesa')?.value;

    if (!dataDespesa) {
        mostrarNotificacao('Informe a data da despesa.', 'erro');
        return;
    }

    if (!descricao) {
        mostrarNotificacao('Informe a descrição da despesa.', 'erro');
        return;
    }

    if (!valor || valor <= 0) {
        mostrarNotificacao('Informe um valor válido para a despesa.', 'erro');
        return;
    }

    const despesa = {
        dataDespesa,
        data: dataDespesa,
        descricao,
        categoria: document.getElementById('categoriaDespesa')?.value || 'Outros',
        valor,
        pagamento: document.getElementById('pagamentoDespesa')?.value || 'Pix',
        responsavel: document.getElementById('responsavelDespesa')?.value || 'Loja',
        observacao: document.getElementById('observacaoDespesa')?.value.trim() || '',
        registradoPor: currentUser?.email || '',
        dataCriacao: new Date().toISOString()
    };

    try {
        await window.addDoc(window.collection(window.db, 'despesas'), despesa);
        mostrarNotificacao(`Despesa registrada: ${formatarMoeda(valor)}`, 'sucesso');
        atualizarMensagemDespesa('Despesa registrada com sucesso.', 'sucesso');

        document.getElementById('despesaForm').reset();
        definirDataDespesaPadrao();
        await carregarDespesas();
        await carregarRelatorio();
    } catch (error) {
        console.error('Erro ao registrar despesa:', error);
        mostrarNotificacao(`Erro ao registrar despesa: ${error.message}`, 'erro');
        atualizarMensagemDespesa(`Erro: ${error.message}`, 'erro');
    }
}

async function carregarDespesas() {
    const listaDiv = document.getElementById('despesasLista');
    const resumoDiv = document.getElementById('despesasResumo');
    if (!listaDiv) return;

    listaDiv.innerHTML = '<p>Carregando despesas...</p>';

    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'despesas'));
        const despesas = [];

        snapshot.forEach(docSnap => {
            const despesa = docSnap.data();
            despesas.push({
                id: docSnap.id,
                ...despesa,
                valor: converterNumero(despesa.valor),
                dataOrdenacao: (converterData(despesa.dataDespesa || despesa.data || despesa.dataCriacao) || new Date(0)).getTime()
            });
        });

        despesas.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const totalGeral = despesas.reduce((acc, d) => acc + d.valor, 0);
        const totalMes = despesas
            .filter(d => (converterData(d.dataDespesa || d.data || d.dataCriacao) || new Date(0)) >= inicioMes)
            .reduce((acc, d) => acc + d.valor, 0);

        if (resumoDiv) resumoDiv.textContent = `${formatarMoeda(totalMes)} este mês`;

        if (despesas.length === 0) {
            listaDiv.innerHTML = '<p>Nenhuma despesa registrada.</p>';
            return;
        }

        const resumoHtml = `
            <div class="expense-summary">
                <div class="mini-stat">
                    <label>Este mês</label>
                    <strong>${formatarMoeda(totalMes)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Total geral</label>
                    <strong>${formatarMoeda(totalGeral)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Registros</label>
                    <strong>${despesas.length}</strong>
                </div>
            </div>
        `;

        const listaHtml = despesas.slice(0, 30).map(d => `
            <div class="compact-item">
                <div>
                    <strong>${escaparHtml(d.descricao)}</strong>
                    <div class="meta">
                        ${formatarDataCurta(d.dataDespesa || d.data || d.dataCriacao)}
                        · ${escaparHtml(d.categoria || 'Outros')}
                        · ${escaparHtml(d.pagamento || '-')}
                        · ${escaparHtml(d.responsavel || 'Loja')}
                    </div>
                    ${d.observacao ? `<div class="meta">${escaparHtml(d.observacao)}</div>` : ''}
                </div>
                <div class="compact-actions">
                    <span class="valor">${formatarMoeda(d.valor)}</span>
                    <button type="button" class="btn-danger" onclick="window.excluirDespesa('${d.id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');

        listaDiv.innerHTML = `${resumoHtml}<div class="compact-list">${listaHtml}</div>`;
    } catch (error) {
        console.error('Erro ao carregar despesas:', error);
        listaDiv.innerHTML = `Erro ao carregar despesas: ${error.message}`;
    }
}

window.excluirDespesa = async function(despesaId) {
    if (!confirm('Deseja excluir esta despesa?')) {
        return;
    }

    try {
        await window.deleteDoc(window.doc(window.db, 'despesas', despesaId));
        mostrarNotificacao('Despesa excluída.', 'aviso');
        await carregarDespesas();
        await carregarRelatorio();
    } catch (error) {
        console.error('Erro ao excluir despesa:', error);
        mostrarNotificacao(`Erro ao excluir despesa: ${error.message}`, 'erro');
    }
};

// ============================================================
// CAIXA - AJUSTES DE SALDO REAL
// ============================================================
function definirDataCaixaPadrao() {
    const dataCaixa = document.getElementById('dataCaixa');
    if (dataCaixa && !dataCaixa.value) {
        dataCaixa.value = obterDataInputHoje();
    }
}

async function calcularPosicaoFinanceiraGeral() {
    const [
        vendasSnapshot,
        comprasSnapshot,
        despesasSnapshot,
        lotesSnapshot
    ] = await Promise.all([
        window.getDocs(window.collection(window.db, 'vendas')),
        window.getDocs(window.collection(window.db, 'compras')),
        window.getDocs(window.collection(window.db, 'despesas')),
        window.getDocs(window.collection(window.db, 'lotes'))
    ]);

    let caixaSnapshot = null;
    try {
        caixaSnapshot = await window.getDocs(window.collection(window.db, 'caixa'));
    } catch (error) {
        console.warn('Não foi possível carregar ajustes de caixa:', error);
    }

    let faturamentoLiquidoGeral = 0;
    let totalComprasGeral = 0;
    let totalDespesasGeral = 0;
    let entradasCaixaGeral = 0;
    let saidasCaixaGeral = 0;
    let valorEstoque = 0;
    let totalUnidadesEstoque = 0;
    let lotesAtivos = 0;

    vendasSnapshot.forEach(docSnap => {
        const venda = docSnap.data();
        if (venda.cancelada === true) return;
        const valorLiquido = venda.valorLiquido !== undefined
            ? converterNumero(venda.valorLiquido)
            : converterNumero(venda.valorTotal);
        faturamentoLiquidoGeral += valorLiquido;
    });

    comprasSnapshot.forEach(docSnap => {
        totalComprasGeral += converterNumero(docSnap.data().valorTotal);
    });

    despesasSnapshot.forEach(docSnap => {
        totalDespesasGeral += converterNumero(docSnap.data().valor);
    });

    caixaSnapshot?.forEach(docSnap => {
        const movimento = docSnap.data();
        const valor = converterNumero(movimento.valor);
        if (movimento.tipo === 'saida') {
            saidasCaixaGeral += valor;
        } else {
            entradasCaixaGeral += valor;
        }
    });

    lotesSnapshot.forEach(docSnap => {
        const lote = docSnap.data();
        const saldo = calcularSaldoLote(lote);
        if (saldo > 0) {
            valorEstoque += saldo * converterNumero(lote.custoUnitario);
            totalUnidadesEstoque += saldo;
            lotesAtivos++;
        }
    });

    const ajustesCaixaGeral = entradasCaixaGeral - saidasCaixaGeral;
    const saldoCaixaEstimado = faturamentoLiquidoGeral - totalComprasGeral - totalDespesasGeral + ajustesCaixaGeral;
    const valorRealEstimado = valorEstoque + saldoCaixaEstimado;

    return {
        faturamentoLiquidoGeral,
        totalComprasGeral,
        totalDespesasGeral,
        entradasCaixaGeral,
        saidasCaixaGeral,
        ajustesCaixaGeral,
        saldoCaixaEstimado,
        valorEstoque,
        valorRealEstimado,
        totalUnidadesEstoque,
        lotesAtivos
    };
}

async function registrarMovimentoCaixa(event) {
    event.preventDefault();

    const dataCaixa = document.getElementById('dataCaixa')?.value;
    const tipo = document.getElementById('tipoCaixa')?.value === 'saida' ? 'saida' : 'entrada';
    const categoria = document.getElementById('categoriaCaixa')?.value || 'Ajuste';
    const valor = converterNumero(document.getElementById('valorCaixa')?.value);
    const descricaoInformada = document.getElementById('descricaoCaixa')?.value.trim();

    if (!dataCaixa) {
        mostrarNotificacao('Informe a data do movimento.', 'erro');
        return;
    }

    if (!valor || valor <= 0) {
        mostrarNotificacao('Informe um valor válido para o caixa.', 'erro');
        return;
    }

    const movimento = {
        dataCaixa,
        data: dataCaixa,
        tipo,
        categoria,
        valor,
        descricao: descricaoInformada || `${categoria} de caixa`,
        registradoPor: currentUser?.email || '',
        dataCriacao: new Date().toISOString()
    };

    try {
        await window.addDoc(window.collection(window.db, 'caixa'), movimento);
        mostrarNotificacao(`${tipo === 'saida' ? 'Saída' : 'Entrada'} registrada: ${formatarMoeda(valor)}`, 'sucesso');

        document.getElementById('caixaForm').reset();
        definirDataCaixaPadrao();
        await carregarCaixa();
        await carregarRelatorio();
    } catch (error) {
        console.error('Erro ao registrar movimento de caixa:', error);
        mostrarNotificacao(`Erro ao registrar caixa: ${error.message}`, 'erro');
    }
}

async function carregarCaixa() {
    const listaDiv = document.getElementById('caixaLista');
    const resumoDiv = document.getElementById('caixaResumo');
    if (!listaDiv) return;

    listaDiv.innerHTML = '<p>Carregando caixa...</p>';

    try {
        const posicao = await calcularPosicaoFinanceiraGeral();
        let caixaSnapshot = null;

        try {
            caixaSnapshot = await window.getDocs(window.collection(window.db, 'caixa'));
        } catch (error) {
            console.warn('Não foi possível carregar movimentos de caixa:', error);
        }

        const movimentos = [];
        caixaSnapshot?.forEach(docSnap => {
            const movimento = docSnap.data();
            movimentos.push({
                id: docSnap.id,
                ...movimento,
                valor: converterNumero(movimento.valor),
                tipo: movimento.tipo === 'saida' ? 'saida' : 'entrada',
                dataOrdenacao: (converterData(movimento.dataCaixa || movimento.data || movimento.dataCriacao) || new Date(0)).getTime()
            });
        });

        movimentos.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

        if (resumoDiv) {
            resumoDiv.textContent = formatarMoeda(posicao.saldoCaixaEstimado);
        }

        const resumoHtml = `
            <div class="expense-summary">
                <div class="mini-stat">
                    <label>Caixa estimado</label>
                    <strong>${formatarMoeda(posicao.saldoCaixaEstimado)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Estoque atual</label>
                    <strong>${formatarMoeda(posicao.valorEstoque)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Valor real</label>
                    <strong>${formatarMoeda(posicao.valorRealEstimado)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Ajustes manuais</label>
                    <strong>${formatarMoeda(posicao.ajustesCaixaGeral)}</strong>
                </div>
            </div>
        `;

        if (movimentos.length === 0) {
            const mensagem = caixaSnapshot
                ? 'Nenhum movimento manual de caixa registrado.'
                : 'Não foi possível carregar movimentos manuais de caixa agora.';
            listaDiv.innerHTML = `${resumoHtml}<p>${mensagem}</p>`;
            return;
        }

        const listaHtml = movimentos.slice(0, 30).map(movimento => {
            const isSaida = movimento.tipo === 'saida';
            return `
                <div class="compact-item">
                    <div>
                        <strong>${escaparHtml(movimento.descricao || movimento.categoria || 'Movimento de caixa')}</strong>
                        <div class="meta">
                            ${formatarDataCurta(movimento.dataCaixa || movimento.data || movimento.dataCriacao)}
                            · ${escaparHtml(movimento.categoria || 'Ajuste')}
                            · ${isSaida ? 'Saída' : 'Entrada'}
                        </div>
                    </div>
                    <div class="compact-actions">
                        <span class="valor ${isSaida ? 'vermelho' : ''}">${isSaida ? '-' : '+'} ${formatarMoeda(movimento.valor)}</span>
                        <button type="button" class="btn-danger" onclick="window.excluirMovimentoCaixa('${movimento.id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listaDiv.innerHTML = `${resumoHtml}<div class="compact-list">${listaHtml}</div>`;
    } catch (error) {
        console.error('Erro ao carregar caixa:', error);
        listaDiv.innerHTML = `Erro ao carregar caixa: ${error.message}`;
    }
}

window.excluirMovimentoCaixa = async function(movimentoId) {
    if (!confirm('Deseja excluir este movimento de caixa?')) {
        return;
    }

    try {
        await window.deleteDoc(window.doc(window.db, 'caixa', movimentoId));
        mostrarNotificacao('Movimento de caixa excluído.', 'aviso');
        await carregarCaixa();
        await carregarRelatorio();
    } catch (error) {
        console.error('Erro ao excluir movimento de caixa:', error);
        mostrarNotificacao(`Erro ao excluir caixa: ${error.message}`, 'erro');
    }
};

// ============================================================
// PARCELAS - MOSTRAR/ESCONDER
// ============================================================
function toggleParcelas() {
    const pagamento = document.getElementById('pagamentoVenda').value;
    const parcelasRow = document.getElementById('parcelasRow');
    const repasseRow = document.getElementById('repasseRow');
    const repasseJuros = document.getElementById('repasseJuros');

    if (pagamento === 'Crédito') {
        parcelasRow.style.display = 'block';
    } else {
        parcelasRow.style.display = 'none';
        document.getElementById('parcelasVenda').value = '1';
    }

    if (pagamento === 'Crédito' || pagamento === 'Débito') {
        if (repasseRow) repasseRow.style.display = 'block';
    } else {
        if (repasseRow) repasseRow.style.display = 'none';
        if (repasseJuros) repasseJuros.checked = false;
    }

    atualizarResumoVenda();
    calcularPreview();
}

function repasseJurosAtivo() {
    const pagamento = document.getElementById('pagamentoVenda')?.value;
    const repasse = document.getElementById('repasseJuros')?.checked === true;
    return repasse && (pagamento === 'Crédito' || pagamento === 'Débito');
}

function calcularValoresVenda(valorBase, taxa, repasseJuros) {
    const base = Math.max(0, converterNumero(valorBase));
    const taxaAplicada = Math.max(0, converterNumero(taxa));

    if (!base || !taxaAplicada) {
        return {
            valorBase: base,
            valorTotal: base,
            totalCobradoCliente: base,
            valorLiquido: base,
            taxaValor: 0,
            jurosRepassado: 0
        };
    }

    if (repasseJuros) {
        const totalCobradoCliente = base / (1 - taxaAplicada);
        const taxaValor = totalCobradoCliente * taxaAplicada;
        return {
            valorBase: base,
            valorTotal: base,
            totalCobradoCliente,
            valorLiquido: base,
            taxaValor,
            jurosRepassado: totalCobradoCliente - base
        };
    }

    const taxaValor = base * taxaAplicada;
    return {
        valorBase: base,
        valorTotal: base,
        totalCobradoCliente: base,
        valorLiquido: base - taxaValor,
        taxaValor,
        jurosRepassado: 0
    };
}

// ============================================================
// DESCONTOS DA VENDA
// ============================================================
function obterCamposDesconto() {
    return {
        area: document.getElementById('descontoArea'),
        valor: document.getElementById('descontoValor'),
        percentual: document.getElementById('descontoPercentual'),
        resumo: document.getElementById('descontoResumo'),
        historico: document.getElementById('historicoDescontos')
    };
}

function atualizarTotalVendaPorPrecoUnitario() {
    const precoUnitario = converterNumero(document.getElementById('precoVenda')?.value);
    const quantidade = parseInt(document.getElementById('quantidadeVenda')?.value) || 1;
    const pagamento = document.getElementById('pagamentoVenda')?.value;
    const parcelas = parseInt(document.getElementById('parcelasVenda')?.value) || 1;
    const { taxa } = calcularTaxaPagamento(pagamento, parcelas);
    const valores = calcularValoresVenda(precoUnitario * quantidade, taxa, repasseJurosAtivo());
    const previewTotal = document.getElementById('previewTotal');

    if (previewTotal) {
        previewTotal.value = valores.totalCobradoCliente.toFixed(2).replace('.', ',');
    }
}

function calcularDescontoVendaAtual() {
    const referencia = converterNumero(precoSugeridoAtualVenda);
    const precoAtual = converterNumero(document.getElementById('precoVenda')?.value);
    const quantidade = parseInt(document.getElementById('quantidadeVenda')?.value) || 1;
    const descontoUnitario = referencia > 0 ? Math.max(0, referencia - precoAtual) : 0;
    const descontoPercentual = referencia > 0 ? (descontoUnitario / referencia) * 100 : 0;

    return {
        referencia,
        precoAtual,
        quantidade,
        descontoUnitario,
        descontoPercentual,
        descontoTotal: descontoUnitario * quantidade
    };
}

function atualizarResumoDesconto(dados = calcularDescontoVendaAtual()) {
    const { resumo } = obterCamposDesconto();
    if (!resumo) return;

    if (!dados.referencia) {
        resumo.textContent = 'Preço sugerido pendente';
        return;
    }

    if (dados.descontoUnitario <= 0.004) {
        resumo.textContent = 'Sem desconto';
        return;
    }

    resumo.textContent = `${formatarMoeda(dados.descontoTotal)} no total`;
}

function limparCamposDesconto() {
    const campos = obterCamposDesconto();
    if (campos.valor) campos.valor.value = '';
    if (campos.percentual) campos.percentual.value = '';
    if (campos.resumo) campos.resumo.textContent = 'Sem desconto';
    if (campos.historico) campos.historico.innerHTML = '';
    if (campos.area) campos.area.style.display = 'none';
}

function atualizarCamposDesconto() {
    if (bloqueandoAtualizacaoDesconto) return;

    const campos = obterCamposDesconto();
    if (!campos.area) return;

    const dados = calcularDescontoVendaAtual();

    if (!dados.referencia) {
        if (campos.valor) campos.valor.value = '';
        if (campos.percentual) campos.percentual.value = '';
        atualizarResumoDesconto(dados);
        return;
    }

    bloqueandoAtualizacaoDesconto = true;
    if (campos.valor) {
        campos.valor.value = dados.descontoUnitario > 0.004
            ? dados.descontoUnitario.toFixed(2).replace('.', ',')
            : '';
    }
    if (campos.percentual) {
        campos.percentual.value = dados.descontoPercentual > 0.004
            ? dados.descontoPercentual.toFixed(2).replace('.', ',')
            : '';
    }
    bloqueandoAtualizacaoDesconto = false;

    atualizarResumoDesconto(dados);
}

function aplicarDescontoPorValor() {
    if (bloqueandoAtualizacaoDesconto) return;

    const campos = obterCamposDesconto();
    const referencia = converterNumero(precoSugeridoAtualVenda);
    if (!referencia) {
        atualizarResumoDesconto();
        return;
    }

    const desconto = Math.min(referencia, Math.max(0, converterNumero(campos.valor?.value)));
    const percentual = (desconto / referencia) * 100;
    const novoPreco = Math.max(0, referencia - desconto);

    bloqueandoAtualizacaoDesconto = true;
    document.getElementById('precoVenda').value = novoPreco.toFixed(2).replace('.', ',');
    if (campos.percentual) campos.percentual.value = desconto > 0 ? percentual.toFixed(2).replace('.', ',') : '';
    bloqueandoAtualizacaoDesconto = false;

    atualizarTotalVendaPorPrecoUnitario();
    atualizarResumoDesconto(calcularDescontoVendaAtual());
    calcularPreview();
}

function aplicarDescontoPorPercentual() {
    if (bloqueandoAtualizacaoDesconto) return;

    const campos = obterCamposDesconto();
    const referencia = converterNumero(precoSugeridoAtualVenda);
    if (!referencia) {
        atualizarResumoDesconto();
        return;
    }

    const percentual = Math.min(100, Math.max(0, converterNumero(campos.percentual?.value)));
    const desconto = referencia * (percentual / 100);
    const novoPreco = Math.max(0, referencia - desconto);

    bloqueandoAtualizacaoDesconto = true;
    document.getElementById('precoVenda').value = novoPreco.toFixed(2).replace('.', ',');
    if (campos.valor) campos.valor.value = desconto > 0 ? desconto.toFixed(2).replace('.', ',') : '';
    bloqueandoAtualizacaoDesconto = false;

    atualizarTotalVendaPorPrecoUnitario();
    atualizarResumoDesconto(calcularDescontoVendaAtual());
    calcularPreview();
}

async function carregarHistoricoDescontos(produtoSelecionado, precoReferencia) {
    const { historico } = obterCamposDesconto();
    if (!historico || !produtoSelecionado) return;

    historico.innerHTML = '<p>Carregando histórico...</p>';

    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'vendas'));
        const vendas = [];

        snapshot.forEach(docSnap => {
            const venda = docSnap.data();
            if (venda.cancelada === true || !vendaCorrespondeProduto(venda, produtoSelecionado)) return;

            const quantidade = converterNumero(venda.quantidade) || 1;
            const valorTotal = converterNumero(venda.valorTotal);
            const precoUnitario = converterNumero(venda.precoUnitario) || (quantidade > 0 ? valorTotal / quantidade : 0);
            if (!precoUnitario) return;

            const referencia = converterNumero(venda.precoReferencia) || converterNumero(precoReferencia);
            const descontoUnitarioSalvo = converterNumero(venda.descontoValorUnitario);
            const descontoUnitario = descontoUnitarioSalvo || (referencia > 0 ? Math.max(0, referencia - precoUnitario) : 0);
            const descontoPercentualSalvo = converterNumero(venda.descontoPercentual);
            const descontoPercentual = descontoPercentualSalvo || (referencia > 0 ? (descontoUnitario / referencia) * 100 : 0);
            const dataVenda = converterData(venda.data) || new Date(0);

            vendas.push({
                data: venda.data,
                timestamp: dataVenda.getTime(),
                precoUnitario,
                descontoUnitario,
                descontoPercentual,
                pagamento: normalizarFormaPagamento(venda.pagamento) || '-',
                cliente: venda.cliente || ''
            });
        });

        vendas.sort((a, b) => b.timestamp - a.timestamp);

        if (vendas.length === 0) {
            historico.innerHTML = '<p>Nenhuma venda anterior desse produto.</p>';
            return;
        }

        const ultimas = vendas.slice(0, 5);
        const vendasComDesconto = vendas.filter(v => v.descontoUnitario > 0.004);
        const mediaPreco = vendas.reduce((acc, v) => acc + v.precoUnitario, 0) / vendas.length;
        const maiorDesconto = vendasComDesconto.length
            ? Math.max(...vendasComDesconto.map(v => v.descontoUnitario))
            : 0;

        const resumoHtml = `
            <div class="history-summary">
                <div class="mini-stat">
                    <label>Último preço</label>
                    <strong>${formatarMoeda(ultimas[0].precoUnitario)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Média</label>
                    <strong>${formatarMoeda(mediaPreco)}</strong>
                </div>
                <div class="mini-stat">
                    <label>Maior desconto</label>
                    <strong>${formatarMoeda(maiorDesconto)}</strong>
                </div>
            </div>
        `;

        const listaHtml = ultimas.map(v => `
            <div class="compact-item">
                <div>
                    <strong>${formatarDataCurta(v.data)} - ${formatarMoeda(v.precoUnitario)}</strong>
                    <div class="meta">
                        ${escaparHtml(v.pagamento)}
                        ${v.descontoUnitario > 0.004 ? ` · desconto ${formatarMoeda(v.descontoUnitario)} (${formatarPercentual(v.descontoPercentual)})` : ' · sem desconto'}
                    </div>
                </div>
            </div>
        `).join('');

        historico.innerHTML = `${resumoHtml}<div class="compact-list">${listaHtml}</div>`;
    } catch (error) {
        console.error('Erro ao carregar histórico de descontos:', error);
        historico.innerHTML = '<p>Não foi possível carregar o histórico.</p>';
    }
}

// ============================================================
// CALCULAR PREVIEW DA VENDA COM TAXA E CUSTO REAL
// ============================================================
async function calcularPreview() {
    const pagamento = document.getElementById('pagamentoVenda').value;
    const quantidade = parseInt(document.getElementById('quantidadeVenda').value) || 1;
    const parcelas = parseInt(document.getElementById('parcelasVenda').value) || 1;
    const produtoSelecionado = obterProdutoSelecionadoVenda();
    const precoUnitario = converterNumero(document.getElementById('precoVenda')?.value);

    const { taxa, taxaLabel } = calcularTaxaPagamento(pagamento, parcelas);
    const valoresVenda = calcularValoresVenda(precoUnitario * quantidade, taxa, repasseJurosAtivo());
    const valorTotal = valoresVenda.totalCobradoCliente;
    const valorLiquido = valoresVenda.valorLiquido;
    const taxaDisplayLabel = taxa > 0 && repasseJurosAtivo()
        ? `${taxaLabel} repassado`
        : (taxa > 0 ? `-${taxaLabel}` : taxaLabel);

    const previewTotal = document.getElementById('previewTotal');
    if (previewTotal && document.activeElement !== previewTotal) {
        previewTotal.value = valorTotal.toFixed(2).replace('.', ',');
    }

    let custoUnitarioReal = 0;
    if (produtoSelecionado) {
        try {
            const lotes = await buscarLotesDisponiveisPorProduto(produtoSelecionado);

            let totalCusto = 0;
            let totalUnidades = 0;
            lotes.forEach(lote => {
                totalCusto += lote.saldo * lote.custoUnitario;
                totalUnidades += lote.saldo;
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

    document.getElementById('taxaDisplay').value = taxaDisplayLabel;
    document.getElementById('previewLiquido').value = formatarMoeda(valorLiquido);
    document.getElementById('previewLucro').value = formatarMoeda(lucroReal);
    atualizarAtalhosQuantidade();
    atualizarAtalhosPagamento();
    atualizarResumoVenda({ precoUnitario, valoresVenda, lucroReal });

}

// ============================================================
// BUSCAR INFORMAÇÕES DO PRODUTO PARA EXIBIÇÃO
// ============================================================
async function buscarInfoProduto() {
    const produtoSelecionado = obterProdutoSelecionadoVenda();
    const infoDiv = document.getElementById('infoProduto');

    if (!produtoSelecionado) {
        infoDiv.style.display = 'none';
        return;
    }

    try {
        const lotes = await buscarLotesDisponiveisPorProduto(produtoSelecionado);

        let totalCusto = 0;
        let totalUnidades = 0;
        let valorSugerido = null;

        lotes.forEach(lote => {
            totalCusto += lote.saldo * lote.custoUnitario;
            totalUnidades += lote.saldo;
            if (lote.valorSugerido) {
                valorSugerido = lote.valorSugerido;
            }
        });

        if (totalUnidades === 0) {
            infoDiv.style.display = 'none';
            return;
        }

        const custoMedio = totalCusto / totalUnidades;
        const margemBruta = valorSugerido ? ((valorSugerido - custoMedio) / valorSugerido * 100) : 0;

        document.getElementById('estoqueExibicao').textContent = `${totalUnidades} un.`;
        document.getElementById('custoExibicao').textContent = formatarMoeda(custoMedio);
        document.getElementById('sugeridoExibicao').textContent = valorSugerido ? formatarMoeda(valorSugerido) : 'Não definido';
        document.getElementById('margemExibicao').textContent = valorSugerido ? `${margemBruta.toFixed(1).replace('.', ',')}%` : 'Defina o preço';
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
    const produtoSelecionado = obterProdutoSelecionadoVenda();
    const quantidade = parseInt(document.getElementById('quantidadeVenda').value) || 1;

    if (!produtoSelecionado) {
        precoSugeridoAtualVenda = null;
        document.getElementById('precoVenda').value = '';
        document.getElementById('previewTotal').value = 0;
        limparCamposDesconto();
        await calcularPreview();
        return;
    }

    try {
        const camposDesconto = obterCamposDesconto();
        if (camposDesconto.area) camposDesconto.area.style.display = 'block';

        const lotes = await buscarLotesDisponiveisPorProduto(produtoSelecionado);

        let valorSugerido = null;
        lotes.forEach(lote => {
            if (lote.saldo > 0 && lote.valorSugerido) {
                valorSugerido = lote.valorSugerido;
            }
        });

        precoSugeridoAtualVenda = valorSugerido || null;

        if (valorSugerido) {
            document.getElementById('precoVenda').value = valorSugerido.toFixed(2).replace('.', ',');
            atualizarTotalVendaPorPrecoUnitario();
        } else {
            document.getElementById('precoVenda').value = '';
            document.getElementById('previewTotal').value = 0;
        }

        atualizarCamposDesconto();
        await carregarHistoricoDescontos(produtoSelecionado, valorSugerido);
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

function obterFiltrosEstoqueAtuais() {
    return {
        marca: document.getElementById('filtroMarca')?.value || '',
        familia: document.getElementById('filtroFamilia')?.value || '',
        busca: normalizarComparacao(document.getElementById('filtroBuscaEstoque')?.value || '')
    };
}

function lotePassaFiltrosEstoque(lote, filtros) {
    const saldo = calcularSaldoLote(lote);
    if (saldo <= 0 || lote.ativo === false) return false;
    if (filtros.marca && lote.marca !== filtros.marca) return false;
    if (filtros.familia && lote.familia !== filtros.familia) return false;

    const textoProduto = normalizarComparacao([
        lote.produto,
        lote.marca,
        lote.sabor,
        lote.peso,
        lote.familia
    ].filter(Boolean).join(' '));

    return !filtros.busca || textoProduto.includes(filtros.busca);
}

function obterEmojiFamilia(familia) {
    const texto = normalizarComparacao(familia);
    if (texto.includes('whey')) return '🥤';
    if (texto.includes('creatina')) return '💪';
    if (texto.includes('pre') || texto.includes('termogenico')) return '⚡';
    if (texto.includes('vitamina') || texto.includes('multi')) return '💊';
    if (texto.includes('bcaa') || texto.includes('amino')) return '🧬';
    if (texto.includes('hipercalorico') || texto.includes('barra')) return '🍫';
    if (texto.includes('diuretico')) return '🔥';
    return '📦';
}

function formatarValorMensagem(valor) {
    const numero = converterNumero(valor);
    return numero > 0 ? numero.toFixed(2).replace('.', ',') : '-';
}

function limparTextoMensagem(valor, fallback = '-') {
    const texto = (valor || '').toString().replace(/\s+/g, ' ').trim();
    return texto || fallback;
}

function calcularCustoMedioEstoque(lotes) {
    const totalUnidades = lotes.reduce((acc, lote) => acc + converterNumero(lote.saldo), 0);
    if (totalUnidades <= 0) return 0;
    const totalCusto = lotes.reduce((acc, lote) => acc + converterNumero(lote.saldo) * converterNumero(lote.custoUnitario), 0);
    return totalCusto / totalUnidades;
}

function obterValorVendaMensagem(produto) {
    const valorProduto = converterNumero(produto.valorSugerido);
    if (valorProduto > 0) return valorProduto;

    const loteComValor = produto.lotes.find(lote => converterNumero(lote.valorSugerido) > 0);
    return loteComValor ? converterNumero(loteComValor.valorSugerido) : 0;
}

function montarLinhaEstoqueMensagem(produto) {
    const quantidade = converterNumero(produto.totalDisponivel);
    const custo = calcularCustoMedioEstoque(produto.lotes);
    const venda = obterValorVendaMensagem(produto);
    return `${quantidade}x - ${limparTextoMensagem(produto.produto)} - ${limparTextoMensagem(produto.sabor, 'Sem sabor')} - ${limparTextoMensagem(produto.marca)} - ${formatarValorMensagem(custo)} - ${formatarValorMensagem(venda)}`;
}

function calcularTotaisEstoqueMensagem(produtos) {
    return produtos.reduce((totais, produto) => {
        const quantidade = converterNumero(produto.totalDisponivel);
        const custoMedio = calcularCustoMedioEstoque(produto.lotes);
        const venda = obterValorVendaMensagem(produto);

        totais.produtos += 1;
        totais.unidades += quantidade;
        totais.custo += quantidade * custoMedio;
        totais.venda += quantidade * venda;
        return totais;
    }, { produtos: 0, unidades: 0, custo: 0, venda: 0 });
}

function montarMensagemEstoqueWhatsApp(produtos) {
    const grupos = {};
    produtos.forEach(produto => {
        const familia = produto.familia || 'Outros';
        if (!grupos[familia]) grupos[familia] = [];
        grupos[familia].push(produto);
    });
    const totais = calcularTotaisEstoqueMensagem(produtos);

    const linhas = [
        '📦 *ESTOQUE MUNDO MAROMBA* 📦',
        `Atualizado em ${new Date().toLocaleDateString('pt-BR')}`,
        '',
        `Resumo: ${totais.produtos} produto(s) | ${totais.unidades} un.`,
        `Valor em estoque: ${formatarMoeda(totais.custo)}`,
        `Valor se vender tudo: ${formatarMoeda(totais.venda)}`
    ];

    Object.keys(grupos).sort().forEach(familia => {
        const emoji = obterEmojiFamilia(familia);
        linhas.push('', `${emoji} *${limparTextoMensagem(familia, 'Outros').toUpperCase()}* ${emoji}`);

        grupos[familia]
            .sort((a, b) => `${a.produto} ${a.sabor} ${a.marca}`.localeCompare(`${b.produto} ${b.sabor} ${b.marca}`, 'pt-BR'))
            .forEach(produto => linhas.push(montarLinhaEstoqueMensagem(produto)));
    });

    linhas.push(
        '',
        '*TOTAL*',
        `Custo em estoque: ${formatarMoeda(totais.custo)}`,
        `Vendas possÃ­veis: ${formatarMoeda(totais.venda)}`,
        `DiferenÃ§a bruta: ${formatarMoeda(totais.venda - totais.custo)}`
    );

    return linhas.join('\n');
}

async function obterProdutosEstoqueParaMensagem() {
    const filtros = obterFiltrosEstoqueAtuais();
    const snapshot = await window.getDocs(window.collection(window.db, 'lotes'));
    const produtos = {};

    snapshot.forEach(doc => {
        const lote = doc.data();
        if (!lotePassaFiltrosEstoque(lote, filtros)) return;

        const saldo = calcularSaldoLote(lote);
        const chave = criarChaveProdutoDoLote(lote);
        if (!produtos[chave]) {
            produtos[chave] = {
                produto: lote.produto,
                marca: lote.marca,
                sabor: lote.sabor || 'Sem sabor',
                peso: lote.peso || '',
                familia: lote.familia || 'Outros',
                totalDisponivel: 0,
                valorSugerido: null,
                lotes: []
            };
        }

        const valorSugerido = converterNumero(lote.valorSugerido);
        produtos[chave].totalDisponivel += saldo;
        if (valorSugerido > 0 && !produtos[chave].valorSugerido) {
            produtos[chave].valorSugerido = valorSugerido;
        }
        produtos[chave].lotes.push({
            saldo,
            custoUnitario: converterNumero(lote.custoUnitario),
            valorSugerido
        });
    });

    return Object.values(produtos);
}

async function copiarTextoParaAreaTransferencia(texto) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copiado = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copiado) throw new Error('Não foi possível copiar automaticamente.');
}

async function copiarEstoqueWhatsApp() {
    const botao = document.getElementById('copiarEstoqueWhatsapp');
    const textoOriginal = botao?.innerHTML;

    try {
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copiando...';
        }

        const produtos = await obterProdutosEstoqueParaMensagem();
        if (produtos.length === 0) {
            mostrarNotificacao('Nenhum item disponível para copiar com os filtros atuais.', 'aviso');
            return;
        }

        const mensagem = montarMensagemEstoqueWhatsApp(produtos);
        await copiarTextoParaAreaTransferencia(mensagem);
        const totalUnidades = produtos.reduce((acc, produto) => acc + converterNumero(produto.totalDisponivel), 0);
        mostrarNotificacao(`Estoque copiado! ${produtos.length} produto(s), ${totalUnidades} un.`, 'sucesso');
    } catch (error) {
        console.error('Erro ao copiar estoque:', error);
        mostrarNotificacao(`Erro ao copiar estoque: ${error.message}`, 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = textoOriginal || '<i class="fab fa-whatsapp"></i> Copiar WhatsApp';
        }
    }
}

async function carregarEstoqueLotes() {
    try {
        const filtrosEstoque = obterFiltrosEstoqueAtuais();

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
            const saldo = calcularSaldoLote(l);
            if (!lotePassaFiltrosEstoque(l, filtrosEstoque)) return;

            const chave = criarChaveProdutoDoLote(l);
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
                quantidade: converterNumero(l.quantidade),
                vendido: converterNumero(l.vendido),
                saldo: saldo,
                custoUnitario: converterNumero(l.custoUnitario),
                valorSugerido: converterNumero(l.valorSugerido),
                simulacao40: converterNumero(l.simulacao40) || converterNumero(l.custoUnitario) * 1.4
            });
            produtos[chave].totalDisponivel += saldo;
            const valorSugeridoLote = converterNumero(l.valorSugerido);
            if (valorSugeridoLote > 0 && !produtos[chave].valorSugerido) {
                produtos[chave].valorSugerido = valorSugeridoLote;
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
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, ${modoInternoAtivo ? '440px' : '180px'}), 1fr)); gap: 18px;">
            `;

            for (const p of items) {
                const logoUrl = logos[p.marca] || '';
                const valorSugerido = p.valorSugerido || p.lotes[0]?.valorSugerido || null;

                if (modoInternoAtivo) {
    // ===== MODO INTERNO - VISUAL MODERNO =====
    const lucroTotalGeral = p.lotes.reduce((acc, l) => acc + ((l.valorSugerido || 0) - l.custoUnitario) * l.saldo, 0);
    const custoTotalGeral = p.lotes.reduce((acc, l) => acc + l.custoUnitario * l.saldo, 0);
    const margemMedia = p.lotes.reduce((acc, l) => acc + ((l.valorSugerido || 0) - l.custoUnitario) / (l.valorSugerido || 1) * 100, 0) / p.lotes.length;

    html += `
        <div class="stock-internal-card" style="
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
                    ${renderizarImagemProduto(p.produto, p.marca, p.imagemUrl)}
                </div>

                <!-- Nome e Marca -->
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${renderizarLogoMarca(p.marca, logoUrl)}
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
                <div class="stock-lot-table" style="display:grid; grid-template-columns: 1fr 0.5fr 0.8fr 1fr 1fr; gap:6px; font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; padding:0 4px 6px 4px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span><i class="far fa-calendar-alt" style="margin-right:4px;"></i> Lote</span>
                    <span style="text-align:center;"><i class="fas fa-box" style="margin-right:4px;"></i> Disp.</span>
                    <span style="text-align:right;"><i class="fas fa-tag" style="margin-right:4px;"></i> Custo</span>
                    <span style="text-align:right;"><i class="fas fa-coins" style="margin-right:4px;"></i> Custo Total</span>
                    <span style="text-align:right;"><i class="fas fa-chart-line" style="margin-right:4px;"></i> Lucro Total</span>
                </div>
    `;

    p.lotes.forEach(lote => {
        const custoTotal = lote.custoUnitario * lote.saldo;
        const lucroUnitario = lote.valorSugerido ? (lote.valorSugerido - lote.custoUnitario) : 0;
        const lucroTotalLote = lucroUnitario * lote.saldo;
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
                <div class="stock-lot-table" style="display:grid; grid-template-columns: 1fr 0.5fr 0.8fr 1fr 1fr; gap:6px; align-items:center;">
                    <span style="color:#ccc; font-weight:600; font-size:13px;">${lote.dataCompra}</span>
                    <span style="text-align:center; color:#4caf50; font-weight:700; font-size:15px;">${lote.saldo}</span>
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
                        Comprado: <strong style="color:#aaa;">${lote.quantidade}</strong> · Vendido: <strong style="color:#aaa;">${lote.vendido}</strong>
                    </span>
                </div>
            </div>
        `;
    });

    // RESULTADOS DO PRODUTO
    html += `
            </div>

            <!-- RESULTADOS DO PRODUTO -->
            <div class="stock-results-grid" style="
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
            <button onclick="window.location.href='editar-produto.html?id=${p.lotes[0].id}&v=20260814-2'" style="
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
                                ${renderizarImagemProduto(p.produto, p.marca, p.imagemUrl, true)}
                            </div>

                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                ${logoUrl ? `<img src="${escaparHtml(logoUrl)}" alt="${escaparHtml(p.marca)}" style="width:18px; height:18px; object-fit:contain; border-radius:4px;">` : `<span style="width:18px; height:18px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; background:rgba(245,166,35,0.1); color:#F5A623; font-size:9px; font-weight:800;">${escaparHtml(obterIniciaisProduto('', p.marca).slice(0, 2))}</span>`}
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
                                <button onclick="window.location.href='editar-produto.html?id=${p.lotes[0].id}&v=20260814-2'" style="
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
        const saldo = calcularSaldoLote(l);
        if (saldo > 0 && l.ativo !== false) {
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
            const saldo = calcularSaldoLote(l);
            if (saldo <= 0 || l.ativo === false) return;

            const chave = criarChaveProdutoDoLote(l);
            if (!produtos[chave]) {
                produtos[chave] = {
                    nome: l.produto,
                    marca: l.marca,
                    sabor: l.sabor,
                    peso: l.peso,
                    chave,
                    totalSaldo: 0
                };
            }
            produtos[chave].totalSaldo += saldo;
        });

        const selectPerda = document.getElementById('produtoPerda');

        produtosVendaCache = Object.values(produtos).sort((a, b) => {
            return `${a.marca} ${a.nome} ${a.peso} ${a.sabor}`.localeCompare(`${b.marca} ${b.nome} ${b.peso} ${b.sabor}`, 'pt-BR');
        });
        renderizarSelectVenda(document.getElementById('buscaProdutoVenda')?.value || '');

        if (selectPerda) {
            selectPerda.innerHTML = '';
            const optionDefault = document.createElement('option');
            optionDefault.value = '';
            optionDefault.textContent = '🔽 Selecione um produto';
            selectPerda.appendChild(optionDefault);

            const lotesSnapshot = await window.getDocs(window.collection(window.db, 'lotes'));
            lotesSnapshot.forEach(doc => {
                const l = doc.data();
                const saldo = calcularSaldoLote(l);
                if (saldo > 0 && l.ativo !== false) {
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

function renderizarSelectVenda(filtro = '') {
    const selectVenda = document.getElementById('produtoVenda');
    if (!selectVenda) return;

    const selecionadoAtual = selectVenda.value;
    const termo = normalizarComparacao(filtro);
    const produtosFiltrados = produtosVendaCache.filter(produto => {
        if (!termo) return true;
        return normalizarComparacao([
            produto.marca,
            produto.nome,
            produto.peso,
            produto.sabor
        ].join(' ')).includes(termo);
    });

    selectVenda.innerHTML = '';
    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = produtosVendaCache.length
        ? `Selecione um produto (${produtosFiltrados.length} encontrados)`
        : 'Nenhum produto disponível';
    selectVenda.appendChild(optionDefault);

    produtosFiltrados.forEach(produto => {
        const option = document.createElement('option');
        option.value = produto.chave;
        option.textContent = `${produto.marca} - ${produto.nome}${produto.peso ? ` (${produto.peso})` : ''} - ${produto.sabor} - Estoque: ${produto.totalSaldo}`;
        selectVenda.appendChild(option);
    });

    const manteveSelecionado = produtosFiltrados.some(produto => produto.chave === selecionadoAtual);

    if (manteveSelecionado) {
        selectVenda.value = selecionadoAtual;
    } else {
        selectVenda.value = '';
        if (selecionadoAtual) {
            precoSugeridoAtualVenda = null;
            document.getElementById('precoVenda').value = '';
            document.getElementById('previewTotal').value = '0';
            document.getElementById('previewLiquido').value = 'R$ 0,00';
            document.getElementById('previewLucro').value = 'R$ 0,00';
            document.getElementById('infoProduto').style.display = 'none';
            limparCamposDesconto();
        }
    }

    atualizarResumoVenda();
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
                        ${renderizarLogoMarca(m.nome, m.logoUrl, '42px')}
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
    let logoUrl = logoInput.value.trim();

    console.log('📝 Nome digitado:', nome);

    if (!nome) {
        mostrarNotificacao('Digite o nome da marca.', 'erro');
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
            await window.updateDoc(docRef, logoUrl ? { logoUrl } : { nome });
            mostrarNotificacao(`Logo da marca "${nome}" atualizado!`, 'sucesso');
        } else {
            console.log('➕ Criando nova marca...');
            const docRef = await window.addDoc(window.collection(window.db, 'marcas'), {
                nome: nome,
                logoUrl
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
// HISTÓRICO DE MOVIMENTAÇÕES
// ============================================================
function configurarHistoricoMovimentacoes() {
    document.querySelectorAll('[data-historico-tipo]').forEach(botao => {
        botao.addEventListener('click', () => {
            historicoTipoAtual = botao.dataset.historicoTipo || 'vendas';
            atualizarAbasHistorico();
            carregarHistoricoMovimentacoes();
        });
    });

    atualizarAbasHistorico();
}

function atualizarAbasHistorico() {
    document.querySelectorAll('[data-historico-tipo]').forEach(botao => {
        botao.classList.toggle('active', botao.dataset.historicoTipo === historicoTipoAtual);
    });
}

async function carregarHistoricoMovimentacoes() {
    atualizarAbasHistorico();

    if (historicoTipoAtual === 'compras') {
        await carregarHistoricoCompras();
        return;
    }

    await carregarHistoricoVendas();
}

function obterDataInicioHistorico(periodo) {
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

    return dataInicio;
}

function obterFiltroHistorico() {
    return {
        periodo: document.getElementById('filtroPeriodoHistorico')?.value || 'todos',
        busca: normalizarComparacao(document.getElementById('filtroClienteHistorico')?.value || '')
    };
}

function obterTextoBuscaHistorico() {
    return (document.getElementById('filtroClienteHistorico')?.value || '').trim();
}

function obterLabelPeriodoHistorico(periodo) {
    const labels = {
        hoje: 'Hoje',
        semana: 'Últimos 7 dias',
        mes: 'Últimos 30 dias',
        todos: 'Todos os períodos'
    };
    return labels[periodo] || periodo;
}

function obterDataMensagem(valor, incluirHora = false) {
    const data = converterData(valor);
    if (!data) return '-';
    if (!incluirHora) return data.toLocaleDateString('pt-BR');
    return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

async function obterVendasHistoricoFiltradas() {
    const { periodo, busca } = obterFiltroHistorico();
    const dataInicio = obterDataInicioHistorico(periodo);
    const snapshot = await window.getDocs(window.collection(window.db, 'vendas'));
    const vendas = [];

    snapshot.forEach(doc => {
        const v = doc.data();
        if (!dentroDoPeriodo(v.data, dataInicio, periodo)) return;

        const textoBusca = normalizarComparacao([
            v.produto,
            v.marca,
            v.sabor,
            v.peso,
            v.cliente,
            v.contato,
            v.pagamento
        ].filter(Boolean).join(' '));

        if (busca && !textoBusca.includes(busca)) return;
        vendas.push({ ...v, id: doc.id });
    });

    return vendas.sort((a, b) => new Date(b.data) - new Date(a.data));
}

async function obterComprasHistoricoFiltradas() {
    const { periodo, busca } = obterFiltroHistorico();
    const dataInicio = obterDataInicioHistorico(periodo);
    const snapshot = await window.getDocs(window.collection(window.db, 'compras'));
    const compras = [];

    snapshot.forEach(doc => {
        const c = doc.data();
        const dataCompra = c.dataCompra || c.data || c.dataCriacao;
        if (!dentroDoPeriodo(dataCompra, dataInicio, periodo)) return;

        const textoBusca = normalizarComparacao([
            c.produto,
            c.marca,
            c.sabor,
            c.peso,
            c.familia,
            c.valorSugerido,
            c.custoUnitario
        ].filter(Boolean).join(' '));

        if (busca && !textoBusca.includes(busca)) return;
        compras.push({ ...c, id: doc.id, dataHistorico: dataCompra });
    });

    return compras.sort((a, b) => (converterData(b.dataHistorico) || new Date(0)) - (converterData(a.dataHistorico) || new Date(0)));
}

function montarCabecalhoRelatorioMensagem(titulo, periodo, buscaTexto) {
    const linhas = [
        titulo,
        `Período: ${obterLabelPeriodoHistorico(periodo)}`,
        `Gerado em ${obterDataMensagem(new Date(), true)}`
    ];

    if (buscaTexto) {
        linhas.push(`Filtro: ${buscaTexto}`);
    }

    return linhas;
}

function montarLinhaVendaMensagem(venda) {
    const quantidade = converterNumero(venda.quantidade) || 1;
    const pagamento = normalizarFormaPagamento(venda.pagamento) || '-';
    const parcelas = converterNumero(venda.parcelas);
    const formaPagamento = `${pagamento}${parcelas > 1 ? ` ${parcelas}x` : ''}`;
    const valorBase = venda.valorBase !== undefined ? converterNumero(venda.valorBase) : converterNumero(venda.valorTotal);
    const status = venda.cancelada === true ? ' - CANCELADA' : '';

    return `${obterDataMensagem(venda.data)} - ${quantidade}x - ${limparTextoMensagem(venda.produto)} - ${limparTextoMensagem(venda.sabor, 'Sem sabor')} - ${limparTextoMensagem(venda.marca)} - ${formatarMoeda(valorBase)} - ${formaPagamento}${venda.cliente ? ` - ${limparTextoMensagem(venda.cliente)}` : ''}${status}`;
}

function montarRelatorioVendasMensagem(vendas) {
    const { periodo } = obterFiltroHistorico();
    const buscaTexto = obterTextoBuscaHistorico();
    const ativas = vendas.filter(v => v.cancelada !== true);
    const canceladas = vendas.length - ativas.length;
    const totalBruto = ativas.reduce((acc, v) => acc + (v.valorBase !== undefined ? converterNumero(v.valorBase) : converterNumero(v.valorTotal)), 0);
    const totalLiquido = ativas.reduce((acc, v) => acc + (v.valorLiquido !== undefined ? converterNumero(v.valorLiquido) : converterNumero(v.valorTotal)), 0);
    const totalCusto = ativas.reduce((acc, v) => acc + converterNumero(v.custoTotal), 0);
    const totalLucro = ativas.reduce((acc, v) => acc + (v.lucro !== undefined ? converterNumero(v.lucro) : ((v.valorLiquido !== undefined ? converterNumero(v.valorLiquido) : converterNumero(v.valorTotal)) - converterNumero(v.custoTotal))), 0);
    const totalItens = ativas.reduce((acc, v) => acc + converterNumero(v.quantidade), 0);
    const totalTaxas = ativas.reduce((acc, v) => acc + converterNumero(v.taxaValor), 0);
    const totalDescontos = ativas.reduce((acc, v) => acc + converterNumero(v.descontoTotal), 0);

    const linhas = montarCabecalhoRelatorioMensagem('💰 *RELATÓRIO DE VENDAS - MUNDO MAROMBA* 💰', periodo, buscaTexto);
    linhas.push(
        '',
        '*RESUMO*',
        `Vendas ativas: ${ativas.length}`,
        `Itens vendidos: ${totalItens}`,
        `Faturamento: ${formatarMoeda(totalBruto)}`,
        `Líquido: ${formatarMoeda(totalLiquido)}`,
        `Custo: ${formatarMoeda(totalCusto)}`,
        `Lucro: ${formatarMoeda(totalLucro)}`,
        `Taxas: ${formatarMoeda(totalTaxas)}`,
        `Descontos: ${formatarMoeda(totalDescontos)}`,
        `Canceladas: ${canceladas}`,
        '',
        '*HISTÓRICO*'
    );

    vendas.forEach(venda => linhas.push(montarLinhaVendaMensagem(venda)));
    return linhas.join('\n');
}

function montarLinhaCompraMensagem(compra) {
    const quantidade = converterNumero(compra.quantidade);
    const valorTotal = converterNumero(compra.valorTotal);
    const custoUnitario = converterNumero(compra.custoUnitario) || (quantidade > 0 ? valorTotal / quantidade : 0);
    const valorSugerido = converterNumero(compra.valorSugerido);

    return `${obterDataMensagem(compra.dataHistorico || compra.dataCompra || compra.data)} - ${quantidade}x - ${limparTextoMensagem(compra.produto)} - ${limparTextoMensagem(compra.sabor, 'Sem sabor')} - ${limparTextoMensagem(compra.marca)} - custo ${formatarValorMensagem(custoUnitario)} - total ${formatarMoeda(valorTotal)}${valorSugerido > 0 ? ` - venda ${formatarValorMensagem(valorSugerido)}` : ''}`;
}

function montarRelatorioComprasMensagem(compras) {
    const { periodo } = obterFiltroHistorico();
    const buscaTexto = obterTextoBuscaHistorico();
    const totalComprado = compras.reduce((acc, c) => acc + converterNumero(c.valorTotal), 0);
    const totalUnidades = compras.reduce((acc, c) => acc + converterNumero(c.quantidade), 0);
    const produtosUnicos = new Set(compras.map(c => criarChaveProduto(c.produto, c.marca, c.sabor, c.peso))).size;
    const custoMedio = totalUnidades > 0 ? totalComprado / totalUnidades : 0;

    const linhas = montarCabecalhoRelatorioMensagem('🛒 *RELATÓRIO DE COMPRAS - MUNDO MAROMBA* 🛒', periodo, buscaTexto);
    linhas.push(
        '',
        '*RESUMO*',
        `Compras registradas: ${compras.length}`,
        `Produtos únicos: ${produtosUnicos}`,
        `Unidades compradas: ${totalUnidades}`,
        `Total pago: ${formatarMoeda(totalComprado)}`,
        `Custo médio: ${formatarMoeda(custoMedio)}`,
        '',
        '*HISTÓRICO*'
    );

    compras.forEach(compra => linhas.push(montarLinhaCompraMensagem(compra)));
    return linhas.join('\n');
}

async function copiarRelatorioHistoricoWhatsApp(tipo) {
    const botaoId = tipo === 'compras' ? 'copiarRelatorioComprasWhatsapp' : 'copiarRelatorioVendasWhatsapp';
    const botao = document.getElementById(botaoId);
    const textoOriginal = botao?.innerHTML;

    try {
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copiando...';
        }

        const itens = tipo === 'compras'
            ? await obterComprasHistoricoFiltradas()
            : await obterVendasHistoricoFiltradas();

        if (itens.length === 0) {
            mostrarNotificacao(`Nenhum registro de ${tipo} encontrado para copiar.`, 'aviso');
            return;
        }

        const mensagem = tipo === 'compras'
            ? montarRelatorioComprasMensagem(itens)
            : montarRelatorioVendasMensagem(itens);

        await copiarTextoParaAreaTransferencia(mensagem);
        mostrarNotificacao(`Relatório de ${tipo} copiado! ${itens.length} registro(s).`, 'sucesso');
    } catch (error) {
        console.error(`Erro ao copiar relatório de ${tipo}:`, error);
        mostrarNotificacao(`Erro ao copiar relatório: ${error.message}`, 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = textoOriginal || '<i class="fab fa-whatsapp"></i> Copiar';
        }
    }
}

function formatarDataHoraHistorico(valor) {
    const data = converterData(valor);
    if (!data) return '-';
    return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatarDataHistorico(valor) {
    const data = converterData(valor);
    if (!data) return '-';
    return data.toLocaleDateString('pt-BR');
}

function renderizarDetalheHistorico(icone, label, valor) {
    const texto = valor === undefined || valor === null || valor === '' ? '-' : valor;
    return `
        <div class="history-detail">
            <label><i class="${icone}"></i> ${escaparHtml(label)}</label>
            <strong>${escaparHtml(texto)}</strong>
        </div>
    `;
}

function renderizarResumoHistorico(itens) {
    return `
        <div class="mini-stat">
            <label>${itens[0]?.label || '-'}</label>
            <strong>${itens[0]?.valor || '-'}</strong>
        </div>
        <div class="mini-stat">
            <label>${itens[1]?.label || '-'}</label>
            <strong>${itens[1]?.valor || '-'}</strong>
        </div>
        <div class="mini-stat">
            <label>${itens[2]?.label || '-'}</label>
            <strong>${itens[2]?.valor || '-'}</strong>
        </div>
        <div class="mini-stat">
            <label>${itens[3]?.label || '-'}</label>
            <strong>${itens[3]?.valor || '-'}</strong>
        </div>
    `;
}

function renderizarVazioHistorico(mensagem) {
    return `
        <div class="history-empty">
            <i class="fas fa-inbox" style="font-size:34px; color:#333;"></i>
            <p style="margin-top:10px;">${escaparHtml(mensagem)}</p>
        </div>
    `;
}

async function carregarHistoricoVendas() {
    const listaDiv = document.getElementById('historicoLista');
    const resumoDiv = document.getElementById('historicoResumo');
    if (!listaDiv) return;

    listaDiv.innerHTML = '<p>Carregando vendas...</p>';
    if (resumoDiv) resumoDiv.innerHTML = '';

    try {
        const { periodo, busca } = obterFiltroHistorico();
        const dataInicio = obterDataInicioHistorico(periodo);
        const snapshot = await window.getDocs(window.collection(window.db, 'vendas'));

        let vendas = [];
        snapshot.forEach(doc => {
            const v = doc.data();
            if (!dentroDoPeriodo(v.data, dataInicio, periodo)) return;

            const textoBusca = normalizarComparacao([
                v.produto,
                v.marca,
                v.sabor,
                v.peso,
                v.cliente,
                v.contato,
                v.pagamento
            ].filter(Boolean).join(' '));

            if (busca && !textoBusca.includes(busca)) return;

            vendas.push({ ...v, id: doc.id });
        });

        vendas.sort((a, b) => new Date(b.data) - new Date(a.data));

        if (vendas.length === 0) {
            listaDiv.innerHTML = renderizarVazioHistorico('Nenhuma venda encontrada com os filtros selecionados.');
            return;
        }

        const vendasAtivas = vendas.filter(v => v.cancelada !== true);
        const totalVendido = vendasAtivas.reduce((acc, v) => acc + converterNumero(v.valorTotal), 0);
        const totalLiquido = vendasAtivas.reduce((acc, v) => acc + (v.valorLiquido !== undefined ? converterNumero(v.valorLiquido) : converterNumero(v.valorTotal)), 0);
        const totalItens = vendasAtivas.reduce((acc, v) => acc + converterNumero(v.quantidade), 0);
        const canceladas = vendas.filter(v => v.cancelada === true).length;

        if (resumoDiv) {
            resumoDiv.innerHTML = renderizarResumoHistorico([
                { label: 'Vendas ativas', valor: vendasAtivas.length },
                { label: 'Total vendido', valor: formatarMoeda(totalVendido) },
                { label: 'Líquido estimado', valor: formatarMoeda(totalLiquido) },
                { label: 'Itens / canceladas', valor: `${totalItens} / ${canceladas}` }
            ]);
        }

        let html = '<div class="history-list">';

        vendas.forEach(v => {
            const isCancelada = v.cancelada === true;
            const detalhesProduto = [v.marca, v.peso, v.sabor && v.sabor !== 'Sem sabor' ? v.sabor : ''].filter(Boolean).join(' - ');
            const pagamento = normalizarFormaPagamento(v.pagamento) || '-';
            const parcelas = converterNumero(v.parcelas);
            const valorVenda = converterNumero(v.valorTotal);
            const valorLiquido = v.valorLiquido !== undefined ? converterNumero(v.valorLiquido) : valorVenda;
            const taxaValor = converterNumero(v.taxaValor);
            const descontoTotal = converterNumero(v.descontoTotal);
            const custoTotal = converterNumero(v.custoTotal);
            const lucro = v.lucro !== undefined ? converterNumero(v.lucro) : valorLiquido - custoTotal;
            const formaPagamento = `${pagamento}${parcelas > 1 ? ` ${parcelas}x` : ''}`;

            html += `
                <div class="history-card ${isCancelada ? 'cancelada' : ''}">
                    <div class="history-card-header">
                        <div>
                            <div class="history-title-row">
                                <span class="history-kind ${isCancelada ? 'cancelada' : ''}">${isCancelada ? 'Cancelada' : 'Venda'}</span>
                                <strong>${escaparHtml(v.produto || 'Produto sem nome')}</strong>
                            </div>
                            <div class="history-meta">
                                ${detalhesProduto ? `${escaparHtml(detalhesProduto)} · ` : ''}
                                ${converterNumero(v.quantidade)} un. · ${escaparHtml(formaPagamento)}
                            </div>
                        </div>
                        <div>
                            <div class="history-total ${isCancelada ? 'cancelada' : ''}">${formatarMoeda(valorVenda)}</div>
                            <div class="history-meta" style="text-align:right;">Data da venda</div>
                        </div>
                    </div>
                    <div class="history-detail-grid">
                        ${renderizarDetalheHistorico('far fa-calendar-alt', 'Data da venda', formatarDataHoraHistorico(v.data))}
                        ${renderizarDetalheHistorico('fas fa-user', 'Cliente', v.cliente || 'Cliente não identificado')}
                        ${renderizarDetalheHistorico('fas fa-credit-card', 'Pagamento', formaPagamento)}
                        ${renderizarDetalheHistorico('fas fa-box', 'Quantidade', `${converterNumero(v.quantidade)} un.`)}
                        ${renderizarDetalheHistorico('fas fa-calculator', 'Valor líquido', isCancelada ? 'Venda cancelada' : formatarMoeda(valorLiquido))}
                        ${renderizarDetalheHistorico('fas fa-coins', 'Custo / lucro', isCancelada ? '-' : `${formatarMoeda(custoTotal)} / ${formatarMoeda(lucro)}`)}
                        ${renderizarDetalheHistorico('fas fa-percent', 'Taxa', isCancelada ? '-' : formatarMoeda(taxaValor))}
                        ${renderizarDetalheHistorico('fas fa-tags', 'Desconto', isCancelada ? '-' : formatarMoeda(descontoTotal))}
                    </div>
                    <div class="history-card-footer">
                        <div class="history-meta">
                            <i class="fas fa-clock"></i> ${formatarDataHoraHistorico(v.data)}
                            ${v.contato ? ` · <i class="fas fa-phone"></i> ${escaparHtml(v.contato)}` : ''}
                            ${v.vendedor ? ` · <i class="fas fa-user-tie"></i> ${escaparHtml(v.vendedor)}` : ''}
                        </div>
                        ${!isCancelada ? `
                        <div class="history-actions">
                            <button type="button" onclick="window.editarVenda('${v.id}')" class="btn-secondary">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button type="button" onclick="window.cancelarVenda('${v.id}')" class="btn-danger">
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
        listaDiv.innerHTML = renderizarVazioHistorico('Erro ao carregar histórico de vendas.');
    }
}

async function carregarHistoricoCompras() {
    const listaDiv = document.getElementById('historicoLista');
    const resumoDiv = document.getElementById('historicoResumo');
    if (!listaDiv) return;

    listaDiv.innerHTML = '<p>Carregando compras...</p>';
    if (resumoDiv) resumoDiv.innerHTML = '';

    try {
        const { periodo, busca } = obterFiltroHistorico();
        const dataInicio = obterDataInicioHistorico(periodo);
        const snapshot = await window.getDocs(window.collection(window.db, 'compras'));

        const compras = [];
        snapshot.forEach(doc => {
            const c = doc.data();
            const dataCompra = c.dataCompra || c.data || c.dataCriacao;
            if (!dentroDoPeriodo(dataCompra, dataInicio, periodo)) return;

            const textoBusca = normalizarComparacao([
                c.produto,
                c.marca,
                c.sabor,
                c.peso,
                c.familia,
                c.valorSugerido,
                c.custoUnitario
            ].filter(Boolean).join(' '));

            if (busca && !textoBusca.includes(busca)) return;

            compras.push({
                ...c,
                id: doc.id,
                dataHistorico: dataCompra
            });
        });

        compras.sort((a, b) => (converterData(b.dataHistorico) || new Date(0)) - (converterData(a.dataHistorico) || new Date(0)));

        if (compras.length === 0) {
            listaDiv.innerHTML = renderizarVazioHistorico('Nenhuma compra encontrada com os filtros selecionados.');
            return;
        }

        const totalComprado = compras.reduce((acc, c) => acc + converterNumero(c.valorTotal), 0);
        const totalUnidades = compras.reduce((acc, c) => acc + converterNumero(c.quantidade), 0);
        const produtosUnicos = new Set(compras.map(c => criarChaveProduto(c.produto, c.marca, c.sabor, c.peso))).size;
        const custoMedio = totalUnidades > 0 ? totalComprado / totalUnidades : 0;

        if (resumoDiv) {
            resumoDiv.innerHTML = renderizarResumoHistorico([
                { label: 'Compras registradas', valor: compras.length },
                { label: 'Total comprado', valor: formatarMoeda(totalComprado) },
                { label: 'Unidades', valor: totalUnidades },
                { label: 'Produtos / custo médio', valor: `${produtosUnicos} / ${formatarMoeda(custoMedio)}` }
            ]);
        }

        let html = '<div class="history-list">';
        compras.forEach(c => {
            const detalhesProduto = [c.marca, c.peso, c.sabor && c.sabor !== 'Sem sabor' ? c.sabor : ''].filter(Boolean).join(' - ');
            const quantidade = converterNumero(c.quantidade);
            const valorTotal = converterNumero(c.valorTotal);
            const custoUnitario = converterNumero(c.custoUnitario) || (quantidade > 0 ? valorTotal / quantidade : 0);
            const valorSugerido = converterNumero(c.valorSugerido);
            const familia = c.familia || 'Outros';
            const dataCompra = c.dataCompra || c.data || c.dataHistorico;
            const dataRegistro = c.dataCriacao || c.dataHistorico;
            const loteCurto = c.loteId ? c.loteId.slice(0, 8) : '-';

            html += `
                <div class="history-card compra">
                    <div class="history-card-header">
                        <div>
                            <div class="history-title-row">
                                <span class="history-kind compra">Compra</span>
                                <strong>${escaparHtml(c.produto || 'Produto sem nome')}</strong>
                            </div>
                            <div class="history-meta">
                                ${detalhesProduto ? `${escaparHtml(detalhesProduto)} · ` : ''}
                                ${quantidade} un. · ${escaparHtml(familia)}
                            </div>
                        </div>
                        <div>
                            <div class="history-total compra">${formatarMoeda(valorTotal)}</div>
                            <div class="history-meta" style="text-align:right;">Data da compra</div>
                        </div>
                    </div>
                    <div class="history-detail-grid">
                        ${renderizarDetalheHistorico('far fa-calendar-alt', 'Data da compra', formatarDataHistorico(dataCompra))}
                        ${renderizarDetalheHistorico('fas fa-clock', 'Registrado em', formatarDataHoraHistorico(dataRegistro))}
                        ${renderizarDetalheHistorico('fas fa-boxes-stacked', 'Quantidade entrada', `${quantidade} un.`)}
                        ${renderizarDetalheHistorico('fas fa-layer-group', 'Família', familia)}
                        ${renderizarDetalheHistorico('fas fa-coins', 'Custo unitário', formatarMoeda(custoUnitario))}
                        ${renderizarDetalheHistorico('fas fa-money-bill-wave', 'Total pago', formatarMoeda(valorTotal))}
                        ${renderizarDetalheHistorico('fas fa-tag', 'Venda sugerida', valorSugerido > 0 ? formatarMoeda(valorSugerido) : 'Não definida')}
                        ${renderizarDetalheHistorico('fas fa-barcode', 'Lote', loteCurto)}
                    </div>
                    <div class="history-card-footer">
                        <div class="history-meta">
                            <i class="far fa-calendar-alt"></i> compra em ${formatarDataHistorico(dataCompra)}
                            · registrado em ${formatarDataHoraHistorico(dataRegistro)}
                            ${c.registradoPor ? ` · ${escaparHtml(c.registradoPor)}` : ''}
                        </div>
                        <div class="history-actions">
                            <button type="button" onclick="window.abrirEstoqueHistorico()" class="btn-secondary">
                                <i class="fas fa-boxes"></i> Ver estoque
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        listaDiv.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar histórico de compras:', error);
        listaDiv.innerHTML = renderizarVazioHistorico('Erro ao carregar histórico de compras.');
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

        const vendasSnapshot = await window.getDocs(window.collection(window.db, 'vendas'));

        let faturamentoBruto = 0;
        let custoTotalVendido = 0;
        let totalVendas = 0;
        let lucroTotal = 0;
        let totalTaxas = 0;
        let totalDescontos = 0;
        let totalJurosRepassados = 0;
        let faturamentoLiquidoGeral = 0;
        let vendasComDesconto = 0;
        let vendasPorPagamento = { Pix: 0, Dinheiro: 0, Débito: 0, Crédito: 0 };
        let vendasCanceladas = 0;

        vendasSnapshot.forEach(doc => {
            const v = doc.data();
            const vendaNoPeriodo = dentroDoPeriodo(v.data, dataInicio, periodo);

            if (v.cancelada === true) {
                if (vendaNoPeriodo) vendasCanceladas++;
                return;
            }

            const valorTotalVenda = converterNumero(v.valorTotal);
            const valorBaseVenda = v.valorBase !== undefined ? converterNumero(v.valorBase) : valorTotalVenda;
            const totalCobradoCliente = v.totalCobradoCliente !== undefined
                ? converterNumero(v.totalCobradoCliente)
                : valorTotalVenda;
            const custoVenda = converterNumero(v.custoTotal);
            const valorLiquidoVenda = v.valorLiquido !== undefined ? converterNumero(v.valorLiquido) : valorTotalVenda;
            const taxaVenda = v.taxaValor !== undefined ? converterNumero(v.taxaValor) : Math.max(0, totalCobradoCliente - valorLiquidoVenda);
            const quantidadeVenda = converterNumero(v.quantidade) || 1;
            const precoUnitarioVenda = converterNumero(v.precoUnitario) || (quantidadeVenda > 0 ? valorBaseVenda / quantidadeVenda : 0);
            const precoReferenciaVenda = converterNumero(v.precoReferencia);
            const descontoVenda = converterNumero(v.descontoTotal) || (
                precoReferenciaVenda > 0
                    ? Math.max(0, precoReferenciaVenda - precoUnitarioVenda) * quantidadeVenda
                    : 0
            );
            const jurosRepassadoVenda = converterNumero(v.jurosRepassado) || (
                v.repasseJuros === true ? Math.max(0, totalCobradoCliente - valorBaseVenda) : 0
            );
            const pagamento = normalizarFormaPagamento(v.pagamento);

            faturamentoLiquidoGeral += valorLiquidoVenda;

            if (!vendaNoPeriodo) return;

            faturamentoBruto += valorBaseVenda;
            custoTotalVendido += custoVenda;
            totalVendas++;
            totalTaxas += taxaVenda;
            totalDescontos += descontoVenda;
            totalJurosRepassados += jurosRepassadoVenda;
            if (descontoVenda > 0.004) vendasComDesconto++;
            lucroTotal += valorLiquidoVenda - custoVenda;
            if (pagamento && vendasPorPagamento[pagamento] !== undefined) {
                vendasPorPagamento[pagamento] += valorBaseVenda;
            }
        });

        const comprasSnapshot = await window.getDocs(window.collection(window.db, 'compras'));

        let totalInvestidoPeriodo = 0;
        let totalComprasGeral = 0;

        comprasSnapshot.forEach(doc => {
            const c = doc.data();
            const valorCompra = converterNumero(c.valorTotal);

            totalComprasGeral += valorCompra;

            if (!dentroDoPeriodo(c.dataCompra || c.data || c.dataCriacao, dataInicio, periodo)) return;

            totalInvestidoPeriodo += valorCompra;
        });

        const perdasSnapshot = await window.getDocs(window.collection(window.db, 'perdas'));
        let totalPerdas = 0;
        perdasSnapshot.forEach(doc => {
            const p = doc.data();
            if (!dentroDoPeriodo(p.data, dataInicio, periodo)) return;
            totalPerdas += converterNumero(p.valorTotal);
        });

        const despesasSnapshot = await window.getDocs(window.collection(window.db, 'despesas'));
        let totalDespesas = 0;
        let totalDespesasGeral = 0;
        const despesasPorCategoria = {};

        despesasSnapshot.forEach(doc => {
            const d = doc.data();
            const valorDespesa = converterNumero(d.valor);

            totalDespesasGeral += valorDespesa;

            if (!dentroDoPeriodo(d.dataDespesa || d.data || d.dataCriacao, dataInicio, periodo)) return;

            const categoria = d.categoria || 'Outros';
            totalDespesas += valorDespesa;
            despesasPorCategoria[categoria] = (despesasPorCategoria[categoria] || 0) + valorDespesa;
        });

        let entradasCaixaGeral = 0;
        let saidasCaixaGeral = 0;
        let ajustesCaixaPeriodo = 0;

        try {
            const caixaSnapshot = await window.getDocs(window.collection(window.db, 'caixa'));
            caixaSnapshot.forEach(doc => {
                const movimento = doc.data();
                const valorCaixa = converterNumero(movimento.valor);
                const isSaida = movimento.tipo === 'saida';

                if (isSaida) {
                    saidasCaixaGeral += valorCaixa;
                } else {
                    entradasCaixaGeral += valorCaixa;
                }

                if (dentroDoPeriodo(movimento.dataCaixa || movimento.data || movimento.dataCriacao, dataInicio, periodo)) {
                    ajustesCaixaPeriodo += isSaida ? -valorCaixa : valorCaixa;
                }
            });
        } catch (error) {
            console.warn('Não foi possível carregar ajustes de caixa para o relatório:', error);
        }

        const lotesSnapshot = await window.getDocs(window.collection(window.db, 'lotes'));
        let valorEstoque = 0;
        let totalUnidadesEstoque = 0;
        let lotesAtivos = 0;

        lotesSnapshot.forEach(doc => {
            const l = doc.data();
            const saldo = calcularSaldoLote(l);
            if (saldo > 0) {
                valorEstoque += saldo * converterNumero(l.custoUnitario);
                totalUnidadesEstoque += saldo;
                lotesAtivos++;
            }
        });

        const margem = faturamentoBruto > 0 ? (lucroTotal / faturamentoBruto) * 100 : 0;
        const resultadoFinal = lucroTotal - totalPerdas - totalDespesas;
        const margemFinal = faturamentoBruto > 0 ? (resultadoFinal / faturamentoBruto) * 100 : 0;
        const ajustesCaixaGeral = entradasCaixaGeral - saidasCaixaGeral;
        const saldoOperacionalEstimado = faturamentoLiquidoGeral - totalComprasGeral - totalDespesasGeral + ajustesCaixaGeral;
        const valorRealEstimado = valorEstoque + saldoOperacionalEstimado;

        const periodos = {
            'dia': 'Hoje',
            'semana': 'Esta semana',
            'mes': 'Este mês',
            'todos': 'Todos os períodos'
        };

        const categoriasDespesasHtml = Object.entries(despesasPorCategoria)
            .sort((a, b) => b[1] - a[1])
            .map(([categoria, valor]) => `<li><i class="fas fa-receipt"></i> ${escaparHtml(categoria)}: ${formatarMoeda(valor)}</li>`)
            .join('');

        relatorioDiv.innerHTML = `
            <h3 style="margin-bottom:15px;"><i class="fas fa-chart-bar"></i> ${periodos[periodo] || periodo}</h3>

            ${vendasCanceladas > 0 ? `<p style="color:#ff9800; font-size:14px;"><i class="fas fa-exclamation-triangle"></i> ${vendasCanceladas} venda(s) cancelada(s) foram ignoradas neste relatório.</p>` : ''}

            <div class="assist-panel">
                <div class="assist-panel-header">
                    <h3><i class="fas fa-wallet"></i> Posição estimada da loja</h3>
                    <span class="metric-pill">Estoque + caixa</span>
                </div>
                <div class="relatorio-card">
                    <div class="card">
                        <h3><i class="fas fa-scale-balanced"></i> Valor Real Estimado</h3>
                        <div class="valor ${valorRealEstimado < 0 ? 'vermelho' : ''}">${formatarMoeda(valorRealEstimado)}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-wallet"></i> Caixa Estimado</h3>
                        <div class="valor ${saldoOperacionalEstimado < 0 ? 'vermelho' : ''}">${formatarMoeda(saldoOperacionalEstimado)}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-warehouse"></i> Estoque Atual</h3>
                        <div class="valor">${formatarMoeda(valorEstoque)}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-right-left"></i> Ajustes de Caixa</h3>
                        <div class="valor ${ajustesCaixaGeral < 0 ? 'vermelho' : ''}">${formatarMoeda(ajustesCaixaGeral)}</div>
                    </div>
                </div>
                <p style="color:#888; font-size:12px; line-height:1.5;">
                    Estimativa pelo histórico registrado: vendas líquidas - compras - despesas + ajustes manuais de caixa.
                </p>
            </div>

            <p style="color:#888; font-size:12px; line-height:1.5; margin-bottom:14px;">
                Resultado final = lucro líquido das vendas, já com taxa da maquineta, menos despesas e perdas. Descontos já reduzem o resultado pelo preço realmente vendido e também aparecem separados como referência comercial.
            </p>

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
                    <h3><i class="fas fa-scale-balanced"></i> Resultado Final</h3>
                    <div class="valor ${resultadoFinal < 0 ? 'vermelho' : ''}">R$ ${resultadoFinal.toFixed(2)}</div>
                </div>
            </div>

            <div class="relatorio-card">
                <div class="card">
                    <h3><i class="fas fa-percent"></i> Taxas da Maquineta</h3>
                    <div class="valor vermelho">R$ ${totalTaxas.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-hand-holding-dollar"></i> Juros Repassados</h3>
                    <div class="valor laranja">R$ ${totalJurosRepassados.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-tags"></i> Descontos Concedidos</h3>
                    <div class="valor laranja">R$ ${totalDescontos.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-receipt"></i> Despesas</h3>
                    <div class="valor vermelho">R$ ${totalDespesas.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-wallet"></i> Ajuste Caixa</h3>
                    <div class="valor ${ajustesCaixaPeriodo < 0 ? 'vermelho' : ''}">R$ ${ajustesCaixaPeriodo.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-trash-alt"></i> Perdas</h3>
                    <div class="valor vermelho">R$ ${totalPerdas.toFixed(2)}</div>
                </div>
            </div>

            <div class="relatorio-card">
                <div class="card">
                    <h3><i class="fas fa-shopping-cart"></i> Total de Vendas</h3>
                    <div class="valor">${totalVendas}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-hand-holding-usd"></i> Compras no Período</h3>
                    <div class="valor">R$ ${totalInvestidoPeriodo.toFixed(2)}</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-percent"></i> Vendas com Desconto</h3>
                    <div class="valor">${vendasComDesconto}</div>
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
                <div class="card">
                    <h3><i class="fas fa-chart-line"></i> Margem de Lucro</h3>
                    <div class="valor">${margem.toFixed(1)}%</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-chart-pie"></i> Margem Final</h3>
                    <div class="valor ${margemFinal < 0 ? 'vermelho' : ''}">${margemFinal.toFixed(1)}%</div>
                </div>
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

            <div style="margin-top:20px;">
                <h4><i class="fas fa-receipt"></i> Despesas por categoria</h4>
                <ul style="margin-top:10px; list-style:none;">
                    ${categoriasDespesasHtml || '<li>Nenhuma despesa no período.</li>'}
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

window.abrirEstoqueHistorico = function() {
    mudarAba('estoque');
};

window.cancelarVenda = async function(vendaId) {
    if (!confirm('⚠️ Tem certeza que deseja CANCELAR esta venda?\n\nOs produtos serão devolvidos ao estoque.\nEsta ação não pode ser desfeita!')) {
        return;
    }

    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        await window.runTransaction(window.db, async (transaction) => {
            const docSnap = await transaction.get(docRef);

            if (!docSnap.exists()) {
                throw new Error('Venda não encontrada!');
            }

            const venda = docSnap.data();
            if (venda.cancelada === true) {
                throw new Error('Esta venda já está cancelada.');
            }

            const cancelamento = {
                vendaId: vendaId,
                produto: venda.produto,
                marca: venda.marca || '',
                sabor: venda.sabor || '',
                peso: venda.peso || '',
                quantidade: venda.quantidade,
                valorTotal: venda.valorTotal,
                motivo: 'Cancelamento pelo vendedor',
                dataOriginal: venda.data,
                dataCancelamento: new Date().toISOString(),
                canceladoPor: currentUser?.email || 'desconhecido'
            };

            const atualizacoesLotes = [];
            if (venda.lotesUtilizados && venda.lotesUtilizados.length > 0) {
                for (const lote of venda.lotesUtilizados) {
                    const loteRef = window.doc(window.db, 'lotes', lote.loteId);
                    const loteSnap = await transaction.get(loteRef);
                    if (loteSnap.exists()) {
                        const loteData = loteSnap.data();
                        const quantidadeDevolvida = converterNumero(lote.quantidade);
                        const quantidadeTotalLote = converterNumero(loteData.quantidade);
                        const novoVendido = Math.max(0, converterNumero(loteData.vendido) - quantidadeDevolvida);
                        atualizacoesLotes.push({
                            ref: loteRef,
                            vendido: novoVendido,
                            ativo: novoVendido < quantidadeTotalLote
                        });
                    }
                }
            }

            const cancelamentoRef = window.doc(window.collection(window.db, 'cancelamentos_vendas'));
            atualizacoesLotes.forEach(lote => {
                transaction.update(lote.ref, {
                    vendido: lote.vendido,
                    ativo: lote.ativo
                });
            });
            transaction.set(cancelamentoRef, cancelamento);
            transaction.update(docRef, { cancelada: true });
        });

        mostrarNotificacao('Venda cancelada! Produtos devolvidos ao estoque.', 'aviso');
        carregarHistoricoMovimentacoes();
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
