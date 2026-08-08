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

    const consulta = limparConsulta(`${termo} produto suplemento embalagem`);

    try {
        if (apiKey && searchEngineId) {
            const imagensGoogle = await buscarGoogle(consulta, apiKey, searchEngineId);
            if (imagensGoogle.length > 0) {
                return respostaJson(200, { imagens: imagensGoogle, fonte: 'google' });
            }
        }

        const imagensDuck = await buscarDuckDuckGo(consulta);
        if (imagensDuck.length > 0) {
            return respostaJson(200, { imagens: imagensDuck, fonte: 'duckduckgo' });
        }

        const imagensBing = await buscarBing(consulta);
        if (imagensBing.length > 0) {
            return respostaJson(200, { imagens: imagensBing, fonte: 'bing' });
        }

        return respostaJson(404, {
            erro: 'Nenhuma imagem encontrada para esse produto.',
            imagens: []
        });
    } catch (error) {
        return respostaJson(500, {
            erro: error.message || 'Erro ao buscar imagens.',
            imagens: []
        });
    }
};

async function buscarGoogle(consulta, apiKey, searchEngineId) {
    const parametros = new URLSearchParams({
        key: apiKey,
        cx: searchEngineId,
        q: consulta,
        searchType: 'image',
        imgType: 'photo',
        safe: 'active',
        num: '8'
    });

    const resposta = await fetch(`https://www.googleapis.com/customsearch/v1?${parametros}`);
    const dados = await resposta.json();

    if (!resposta.ok) {
        console.warn('Busca Google indisponível:', dados.error?.message || resposta.status);
        return [];
    }

    return normalizarImagens((dados.items || []).map(item => ({
        titulo: item.title || '',
        url: item.link || '',
        thumbnail: item.image?.thumbnailLink || item.link || '',
        origem: item.image?.contextLink || ''
    })));
}

async function buscarDuckDuckGo(consulta) {
    const headers = criarHeaders();
    const pagina = await fetch(`https://duckduckgo.com/?${new URLSearchParams({ q: consulta, iax: 'images', ia: 'images' })}`, { headers });
    const html = await pagina.text();
    const tokenMatch = html.match(/vqd=["']?([\d-]+)["']?/) || html.match(/vqd=([\d-]+)&/);

    if (!tokenMatch?.[1]) {
        return [];
    }

    const parametros = new URLSearchParams({
        l: 'br-pt',
        o: 'json',
        q: consulta,
        vqd: tokenMatch[1],
        f: ',,,',
        p: '1'
    });

    const resposta = await fetch(`https://duckduckgo.com/i.js?${parametros}`, { headers });
    if (!resposta.ok) {
        return [];
    }

    const dados = await resposta.json();
    return normalizarImagens((dados.results || []).map(item => ({
        titulo: item.title || '',
        url: item.image || '',
        thumbnail: item.thumbnail || item.image || '',
        origem: item.url || ''
    })));
}

async function buscarBing(consulta) {
    const resposta = await fetch(`https://www.bing.com/images/search?${new URLSearchParams({ q: consulta, form: 'HDRSC2' })}`, {
        headers: criarHeaders()
    });

    if (!resposta.ok) {
        return [];
    }

    const html = await resposta.text();
    const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;.*?turl&quot;:&quot;(.*?)&quot;.*?t&quot;:&quot;(.*?)&quot;/g)];

    return normalizarImagens(matches.map(match => ({
        titulo: decodificarHtml(match[3]),
        url: decodificarHtml(match[1]),
        thumbnail: decodificarHtml(match[2]),
        origem: 'https://www.bing.com/images/search'
    })));
}

function limparConsulta(valor) {
    return (valor || '')
        .replace(/\bsem sabor\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function criarHeaders() {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    };
}

function normalizarImagens(imagens) {
    const vistos = new Set();

    return imagens
        .map(item => ({
            titulo: item.titulo || '',
            url: limparUrl(item.url || ''),
            thumbnail: limparUrl(item.thumbnail || item.url || ''),
            origem: item.origem || ''
        }))
        .filter(item => {
            if (!item.url || vistos.has(item.url)) return false;
            if (!/^https?:\/\//i.test(item.url)) return false;
            vistos.add(item.url);
            return true;
        })
        .slice(0, 8);
}

function limparUrl(valor) {
    return decodificarHtml(valor)
        .replace(/\\\//g, '/')
        .replace(/\\u002f/g, '/')
        .trim();
}

function decodificarHtml(valor) {
    return (valor || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function respostaJson(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(body)
    };
}
