// ============================================================
// EDITAR VENDA
// ============================================================

const urlParams = new URLSearchParams(window.location.search);
const vendaId = urlParams.get('id');
let vendaAtual = null;

document.addEventListener('DOMContentLoaded', async function() {
    if (!vendaId) {
        document.getElementById('message').innerHTML = '❌ Venda não identificada.';
        document.getElementById('message').className = 'message erro';
        return;
    }
    
    await carregarVenda();
    
    // Eventos
    document.getElementById('editarVendaForm').addEventListener('submit', salvarAlteracoes);
    document.getElementById('voltarBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    document.getElementById('cancelarVendaBtn').addEventListener('click', cancelarVenda);
    
    // Mostrar/esconder parcelas
    document.getElementById('pagamento').addEventListener('change', function() {
        const parcelasGroup = document.getElementById('parcelasGroup');
        if (this.value === 'Crédito') {
            parcelasGroup.style.display = 'block';
        } else {
            parcelasGroup.style.display = 'none';
        }
    });
});

async function carregarVenda() {
    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        const docSnap = await window.getDoc(docRef);
        
        if (!docSnap.exists()) {
            window.mostrarNotificacao('❌ Venda não encontrada!', 'erro');
            return;
        }
        
        vendaAtual = docSnap.data();
        
        document.getElementById('vendaTitulo').innerHTML = `
            <strong>${vendaAtual.produto}</strong><br>
            <small>Data: ${new Date(vendaAtual.data).toLocaleDateString('pt-BR')} | ID: ${vendaId.substring(0, 8)}...</small>
        `;
        
        document.getElementById('produto').value = vendaAtual.produto || '';
        document.getElementById('quantidade').value = vendaAtual.quantidade || 0;
        document.getElementById('cliente').value = vendaAtual.cliente || 'Cliente não identificado';
        document.getElementById('valorTotal').value = vendaAtual.valorTotal || 0;
        document.getElementById('pagamento').value = vendaAtual.pagamento || 'Pix';
        document.getElementById('parcelas').value = vendaAtual.parcelas || 1;
        
        if (vendaAtual.pagamento === 'Crédito') {
            document.getElementById('parcelasGroup').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Erro:', error);
        window.mostrarNotificacao(`❌ Erro ao carregar venda: ${error.message}`, 'erro');
    }
}
async function salvarAlteracoes(event) {
    event.preventDefault();
    
    const novoPagamento = document.getElementById('pagamento').value;
    const novasParcelas = parseInt(document.getElementById('parcelas').value) || 1;
    
    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        await window.updateDoc(docRef, {
            pagamento: novoPagamento,
            parcelas: novasParcelas
        });
        
        // 🔔 NOTIFICAÇÃO FLUTUANTE
        window.mostrarNotificacao(`✅ Venda atualizada para ${novoPagamento}${novasParcelas > 1 ? ` ${novasParcelas}x` : ''}`, 'sucesso');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        window.mostrarNotificacao(`❌ Erro ao salvar: ${error.message}`, 'erro');
    }
}
async function cancelarVenda() {
    if (!confirm('⚠️ Tem certeza que deseja CANCELAR esta venda?\n\nOs produtos serão devolvidos ao estoque.\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    try {
        const docRef = window.doc(window.db, 'vendas', vendaId);
        const docSnap = await window.getDoc(docRef);
        
        if (!docSnap.exists()) {
            window.mostrarNotificacao('❌ Venda não encontrada!', 'erro');
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
            canceladoPor: window.currentUser?.email || 'desconhecido'
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
        
        window.mostrarNotificacao('⚠️ Venda cancelada! Produtos devolvidos ao estoque.', 'aviso');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Erro ao cancelar venda:', error);
        window.mostrarNotificacao(`❌ Erro ao cancelar venda: ${error.message}`, 'erro');
    }
}