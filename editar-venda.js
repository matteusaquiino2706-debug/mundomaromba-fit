// ============================================================
// EDITAR VENDA
// ============================================================

const urlParams = new URLSearchParams(window.location.search);
const vendaId = urlParams.get('id');
let vendaAtual = null;
let currentUser = null;

const TAXAS_MAQUINETA = {
    debito: 0.0087,
    credito_1x: 0.0308,
    credito_2x: 0.0579,
    credito_3x: 0.0659,
    credito_4x: 0.0839,
    credito_5x: 0.0859,
    credito_6x: 0.0869
};

document.addEventListener('DOMContentLoaded', function() {
    if (!vendaId) {
        mostrarMensagem('Venda não identificada.', 'erro');
        return;
    }

    window.onAuthStateChanged(window.auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        window.currentUser = user;
        configurarEventos();
        await carregarVenda();
    });
});

function configurarEventos() {
    document.getElementById('editarVendaForm').addEventListener('submit', salvarAlteracoes);
    document.getElementById('voltarBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    document.getElementById('cancelarVendaBtn').addEventListener('click', cancelarVenda);

    document.getElementById('pagamento').addEventListener('change', function() {
        atualizarCamposPagamento();
        atualizarPreviewPagamentoEditado();
    });
    document.getElementById('parcelas').addEventListener('change', atualizarPreviewPagamentoEditado);
    document.getElementById('repasseJuros').addEventListener('change', atualizarPreviewPagamentoEditado);
}

function mostrarMensagem(mensagem, tipo = 'sucesso') {
    const message = document.getElementById('message');
    if (!message) {
        alert(mensagem);
        return;
    }

    message.innerHTML = mensagem;
    message.className = `message ${tipo === 'erro' ? 'erro' : 'sucesso'}`;
}

function calcularTaxaPagamento(pagamento, parcelas) {
    if (pagamento === 'Débito') {
        return TAXAS_MAQUINETA.debito;
    }

    if (pagamento === 'Crédito') {
        const parcelasValidas = Math.min(Math.max(parseInt(parcelas) || 1, 1), 6);
        return TAXAS_MAQUINETA[`credito_${parcelasValidas}x`] || 0;
    }

    return 0;
}

function repasseJurosAtivo() {
    const pagamento = document.getElementById('pagamento')?.value;
    const repasse = document.getElementById('repasseJuros')?.checked === true;
    return repasse && (pagamento === 'Crédito' || pagamento === 'Débito');
}

function calcularValoresVenda(valorBase, taxa, repasseJuros) {
    const base = Math.max(0, parseFloat(valorBase) || 0);
    const taxaAplicada = Math.max(0, parseFloat(taxa) || 0);

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

function atualizarCamposPagamento() {
    const pagamento = document.getElementById('pagamento').value;
    const parcelasGroup = document.getElementById('parcelasGroup');
    const repasseGroup = document.getElementById('repasseGroup');
    const repasseJuros = document.getElementById('repasseJuros');

    if (pagamento === 'Crédito') {
        parcelasGroup.style.display = 'block';
    } else {
        parcelasGroup.style.display = 'none';
        document.getElementById('parcelas').value = '1';
    }

    if (pagamento === 'Crédito' || pagamento === 'Débito') {
        repasseGroup.style.display = 'block';
    } else {
        repasseGroup.style.display = 'none';
        repasseJuros.checked = false;
    }
}

function atualizarPreviewPagamentoEditado() {
    if (!vendaAtual) return;

    const novoPagamento = document.getElementById('pagamento').value;
    const novasParcelas = novoPagamento === 'Crédito' ? (parseInt(document.getElementById('parcelas').value) || 1) : 1;
    const valorBase = vendaAtual.valorBase !== undefined ? (parseFloat(vendaAtual.valorBase) || 0) : (parseFloat(vendaAtual.valorTotal) || 0);
    const taxa = calcularTaxaPagamento(novoPagamento, novasParcelas);
    const valores = calcularValoresVenda(valorBase, taxa, repasseJurosAtivo());

    document.getElementById('valorTotal').value = valores.totalCobradoCliente.toFixed(2);
}

async function carregarVenda() {
    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        const docSnap = await window.getDoc(docRef);

        if (!docSnap.exists()) {
            mostrarMensagem('Venda não encontrada!', 'erro');
            return;
        }

        vendaAtual = docSnap.data();
        const detalhesProduto = [vendaAtual.marca, vendaAtual.peso, vendaAtual.sabor].filter(Boolean).join(' - ');

        document.getElementById('vendaTitulo').innerHTML = `
            <strong>${vendaAtual.produto}</strong><br>
            ${detalhesProduto ? `<small>${detalhesProduto}</small><br>` : ''}
            <small>Data: ${new Date(vendaAtual.data).toLocaleDateString('pt-BR')} | ID: ${vendaId.substring(0, 8)}...</small>
        `;

        document.getElementById('produto').value = detalhesProduto ? `${vendaAtual.produto} - ${detalhesProduto}` : (vendaAtual.produto || '');
        document.getElementById('quantidade').value = vendaAtual.quantidade || 0;
        document.getElementById('cliente').value = vendaAtual.cliente || 'Cliente não identificado';
        document.getElementById('valorTotal').value = vendaAtual.valorTotal || 0;
        document.getElementById('pagamento').value = vendaAtual.pagamento || 'Pix';
        const parcelasSalvas = Math.min(Math.max(parseInt(vendaAtual.parcelas) || 1, 1), 6);
        document.getElementById('parcelas').value = parcelasSalvas;
        document.getElementById('repasseJuros').checked = vendaAtual.repasseJuros === true;

        atualizarCamposPagamento();
        atualizarPreviewPagamentoEditado();

    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem(`Erro ao carregar venda: ${error.message}`, 'erro');
    }
}

async function salvarAlteracoes(event) {
    event.preventDefault();

    const novoPagamento = document.getElementById('pagamento').value;
    const novasParcelas = novoPagamento === 'Crédito' ? (parseInt(document.getElementById('parcelas').value) || 1) : 1;

    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        const valorBase = vendaAtual.valorBase !== undefined ? (parseFloat(vendaAtual.valorBase) || 0) : (parseFloat(vendaAtual.valorTotal) || 0);
        const custoTotal = vendaAtual.custoTotal || 0;
        const taxa = calcularTaxaPagamento(novoPagamento, novasParcelas);
        const repasseJuros = repasseJurosAtivo();
        const valores = calcularValoresVenda(valorBase, taxa, repasseJuros);

        await window.updateDoc(docRef, {
            pagamento: novoPagamento,
            parcelas: novasParcelas,
            taxa,
            repasseJuros,
            valorBase,
            valorTotal: valores.valorTotal,
            totalCobradoCliente: valores.totalCobradoCliente,
            taxaValor: valores.taxaValor,
            jurosRepassado: valores.jurosRepassado,
            valorLiquido: valores.valorLiquido,
            precoUnitarioCobrado: (vendaAtual.quantidade || 1) > 0 ? valores.valorTotal / vendaAtual.quantidade : valores.valorTotal,
            lucroBruto: valorBase - custoTotal,
            lucro: valores.valorLiquido - custoTotal
        });

        mostrarMensagem(`Venda atualizada para ${novoPagamento}${novasParcelas > 1 ? ` ${novasParcelas}x` : ''}`, 'sucesso');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);

    } catch (error) {
        console.error('Erro ao salvar:', error);
        mostrarMensagem(`Erro ao salvar: ${error.message}`, 'erro');
    }
}

async function cancelarVenda() {
    if (!confirm('Tem certeza que deseja CANCELAR esta venda?\n\nOs produtos serão devolvidos ao estoque.\nEsta ação não pode ser desfeita!')) {
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

            const atualizacoesLotes = [];
            if (venda.lotesUtilizados && venda.lotesUtilizados.length > 0) {
                for (const lote of venda.lotesUtilizados) {
                    const loteRef = window.doc(window.db, 'lotes', lote.loteId);
                    const loteSnap = await transaction.get(loteRef);
                    if (loteSnap.exists()) {
                        const loteData = loteSnap.data();
                        const novoVendido = Math.max(0, (loteData.vendido || 0) - lote.quantidade);
                        atualizacoesLotes.push({
                            ref: loteRef,
                            vendido: novoVendido,
                            ativo: novoVendido < loteData.quantidade
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
            transaction.set(cancelamentoRef, {
                vendaId,
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
            });

            transaction.update(docRef, { cancelada: true });
        });

        mostrarMensagem('Venda cancelada! Produtos devolvidos ao estoque.', 'sucesso');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);

    } catch (error) {
        console.error('Erro ao cancelar venda:', error);
        mostrarMensagem(`Erro ao cancelar venda: ${error.message}`, 'erro');
    }
}
