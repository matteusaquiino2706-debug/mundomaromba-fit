exports.handler = async function(event) {
    const termo = (event.queryStringParameters?.q || '').trim();
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!termo) {
        return respostaJson(400, {
            erro: 'Informe o produto para buscar.',
            imagens: []
        });
    }

    if (!apiKey || !searchEngineId) {
        return respostaJson(501, {
            erro: 'Busca de imagens ainda não configurada.',
            detalhes: 'Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_ENGINE_ID nas variáveis do Netlify.',
            imagens: []
        });
    }

    const parametros = new URLSearchParams({
        key: apiKey,
        cx: searchEngineId,
        q: termo,
        searchType: 'image',
        imgType: 'photo',
        safe: 'active',
        num: '6'
    });

    try {
        const resposta = await fetch(`https://www.googleapis.com/customsearch/v1?${parametros}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
            return respostaJson(resposta.status, {
                erro: dados.error?.message || 'Erro ao buscar imagens.',
                imagens: []
            });
        }

        const imagens = (dados.items || []).map(item => ({
            titulo: item.title || '',
            url: item.link || '',
            thumbnail: item.image?.thumbnailLink || item.link || '',
            origem: item.image?.contextLink || ''
        })).filter(item => item.url);

        return respostaJson(200, { imagens });
    } catch (error) {
        return respostaJson(500, {
            erro: error.message || 'Erro ao buscar imagens.',
            imagens: []
        });
    }
};

function respostaJson(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(body)
    };
}
