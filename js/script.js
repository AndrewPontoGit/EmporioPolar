/* ==========================================================
   Empório Polar · js/script.js
   Um único arquivo para o site todo. Cada recurso só roda se o
   elemento dele existir na página (por isso os "if (elemento)").
   Depende de js/produtos.js, que deve ser carregado ANTES.
   ========================================================== */

/* ---------- Utilidades ---------- */
const $ = (seletor, base = document) => base.querySelector(seletor);
const $$ = (seletor, base = document) => [...base.querySelectorAll(seletor)];
const formatarPreco = (valor) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// localStorage pode falhar (modo privado): estas funções evitam erro no Console
function lerSalvo(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function salvar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* ignora */ }
}

/* ==========================================================
   RECURSO 13 · Animação ao rolar (IntersectionObserver)
   ========================================================== */
const observador = new IntersectionObserver((entradas) => {
  entradas.forEach(entrada => {
    if (entrada.isIntersecting) { entrada.target.classList.add("visivel"); observador.unobserve(entrada.target); }
  });
}, { threshold: 0.1 });
function observarRevelar() {
  $$(".revelar:not(.visivel)").forEach(el => observador.observe(el));
}
observarRevelar();

/* Aviso rápido (toast) */
function avisar(texto) {
  let aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.classList.add("visivel");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => aviso.classList.remove("visivel"), 2200);
}

/* ==========================================================
   RECURSO 4 · Cards dinâmicos (a partir do array produtos)
   ========================================================== */
// Estrelas e parcelamento: pequenos cálculos para parecer uma loja de verdade
function estrelas(nota) { const n = Math.round(nota); return "★".repeat(n) + "☆".repeat(5 - n); }
function parcelas(preco) { return preco >= 90 ? 6 : preco >= 45 ? 3 : preco >= 24 ? 2 : 1; }

function criarCard(produto) {
  const desconto = produto.precoAntigo ? Math.round((1 - produto.preco / produto.precoAntigo) * 100) : 0;
  const n = parcelas(produto.preco);
  return `
    <article class="card revelar">
      ${desconto ? `<span class="selo">-${desconto}%</span>` : ""}
      <button class="card-img" data-detalhes="${produto.id}" aria-label="Ver detalhes de ${produto.nome}">
        <img src="${produto.imagem}" alt="${produto.nome}" loading="lazy" width="600" height="600">
      </button>
      <div class="card-corpo">
        <span class="cat-txt">${produto.categoria}</span>
        <h3>${produto.nome}</h3>
        <p>${produto.descricao}</p>
        <div class="estrelas" aria-label="Nota ${produto.avaliacao} de 5">${estrelas(produto.avaliacao)} <small>(${produto.avaliacoes})</small></div>
        <span class="preco-antigo">${produto.precoAntigo ? formatarPreco(produto.precoAntigo) : ""}</span>
        <strong class="preco">${formatarPreco(produto.preco)}</strong>
        <span class="parcela">${n > 1 ? `ou ${n}x de ${formatarPreco(produto.preco / n)} sem juros` : "à vista no PIX ou cartão"}</span>
        <div class="card-fim"><button class="btn btn-comprar" data-id="${produto.id}">Comprar</button></div>
      </div>
    </article>`;
}

// map() transforma cada produto em texto HTML; join("") junta tudo
function mostrarProdutos(lista, area) {
  area.innerHTML = lista.map(criarCard).join("");
  observarRevelar();
}

/* ==========================================================
   RECURSO 5 · Filtro por categoria, busca por nome e ordenação
   ========================================================== */
const areaProdutos = $("#lista-produtos");
if (areaProdutos) {
  const campoBusca = $("#busca");
  const seletorCategoria = $("#categoria");
  const seletorOrdem = $("#ordem");
  const contador = $("#contador");
  const vazio = $("#vazio");

  // Cria as opções do <select> a partir das categorias que existem no array
  const categorias = [...new Set(produtos.map(p => p.categoria))];
  seletorCategoria.innerHTML = `<option value="todas">Todas as categorias</option>` +
    categorias.map(c => `<option value="${c}">${c}</option>`).join("");

  // Home → "Produtos" pode mandar a categoria pela URL (produtos.html?cat=Biscoitos)
  const catUrl = new URLSearchParams(location.search).get("cat");
  if (catUrl && categorias.includes(catUrl)) seletorCategoria.value = catUrl;
  const buscaUrl = new URLSearchParams(location.search).get("q");   // vem da busca do cabeçalho
  if (buscaUrl) campoBusca.value = buscaUrl;

  function filtrar() {
    const texto = campoBusca.value.trim().toLowerCase();
    const categoria = seletorCategoria.value;

    const resultado = produtos.filter(p => {
      const combinaNome = p.nome.toLowerCase().includes(texto);
      const combinaCategoria = categoria === "todas" || p.categoria === categoria;
      return combinaNome && combinaCategoria;
    });

    // sort() ordena; [...] cria uma cópia para não mexer no array original
    const ordem = seletorOrdem.value;
    if (ordem === "menor") resultado.sort((a, b) => a.preco - b.preco);
    if (ordem === "maior") resultado.sort((a, b) => b.preco - a.preco);
    if (ordem === "nome") resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    mostrarProdutos(resultado, areaProdutos);
    contador.textContent = `Mostrando ${resultado.length} de ${produtos.length} produtos`;
    vazio.hidden = resultado.length > 0;   // mensagem "nenhum produto"
  }

  campoBusca.addEventListener("input", filtrar);
  seletorCategoria.addEventListener("change", filtrar);
  seletorOrdem.addEventListener("change", filtrar);
  filtrar();
}

/* Home: produtos em destaque (campo destaque === true) */
const areaDestaques = $("#destaques");
if (areaDestaques) mostrarProdutos(produtos.filter(p => p.destaque), areaDestaques);

/* ==========================================================
   RECURSO 6 · Carrinho de compras (com localStorage)
   Guardamos só { id, qtd }; o preço vem sempre do array produtos.
   ========================================================== */
let carrinho = lerSalvo("carrinho", []);
const painel = $("#painel-carrinho");
const fundoPainel = $("#fundo-painel");

function adicionarAoCarrinho(id) {
  const item = carrinho.find(i => i.id === id);
  if (item) item.qtd++; else carrinho.push({ id, qtd: 1 });
  salvar("carrinho", carrinho);
  atualizarCarrinho();
}

function alterarQuantidade(id, delta) {
  const item = carrinho.find(i => i.id === id);
  if (!item) return;
  item.qtd += delta;
  if (item.qtd <= 0) carrinho = carrinho.filter(i => i.id !== id);  // remove ao chegar em 0
  salvar("carrinho", carrinho);
  atualizarCarrinho();
}

function atualizarCarrinho() {
  const lista = $("#itens-carrinho");
  // reduce() soma o valor de todos os itens
  const total = carrinho.reduce((soma, i) => soma + produtos.find(p => p.id === i.id).preco * i.qtd, 0);
  const quantidade = carrinho.reduce((soma, i) => soma + i.qtd, 0);
  $("#qtd-carrinho").textContent = quantidade;
  $("#total-carrinho").textContent = formatarPreco(total);
  $("#limpar").disabled = $("#finalizar").disabled = quantidade === 0;

  lista.innerHTML = carrinho.length === 0
    ? `<li class="carrinho-vazio">Seu carrinho está vazio.<br>Que tal um panetone?</li>`
    : carrinho.map(i => {
        const p = produtos.find(prod => prod.id === i.id);
        return `<li>
          <img src="${p.imagem}" alt="${p.nome}">
          <div><strong>${p.nome}</strong><small>${formatarPreco(p.preco)} · subtotal ${formatarPreco(p.preco * i.qtd)}</small></div>
          <div class="qtd">
            <button data-menos="${p.id}" aria-label="Diminuir quantidade">−</button>
            <span>${i.qtd}</span>
            <button data-mais="${p.id}" aria-label="Aumentar quantidade">+</button>
          </div>
        </li>`;
      }).join("");
}

function abrirPainel(abrir) {
  painel.classList.toggle("aberto", abrir);
  fundoPainel.classList.toggle("aberto", abrir);
}

$("#btn-carrinho").addEventListener("click", () => abrirPainel(true));
fundoPainel.addEventListener("click", () => abrirPainel(false));
$("#fechar-painel").addEventListener("click", () => abrirPainel(false));
$("#limpar").addEventListener("click", () => { carrinho = []; salvar("carrinho", carrinho); atualizarCarrinho(); });
$("#finalizar").addEventListener("click", () => {
  carrinho = []; salvar("carrinho", carrinho); atualizarCarrinho(); abrirPainel(false);
  avisar("Pedido de teste enviado. Feliz Natal!");
});
atualizarCarrinho();

/* ==========================================================
   RECURSO 3 · Sons (música de fundo + sininho)
   Os navegadores bloqueiam som automático: só tocamos após um clique.
   ========================================================== */
const musica = new Audio("audio/musica-natal.wav");
musica.loop = true;       // repete sem parar
musica.volume = 0.25;     // volume baixo (vai de 0 a 1)
const botaoMusica = $("#btn-musica");

function rotuloMusica() {
  $(".rotulo", botaoMusica).textContent = musica.paused ? "Tocar música" : "Pausar música";
  botaoMusica.setAttribute("aria-pressed", String(!musica.paused));
}
botaoMusica.addEventListener("click", () => {
  if (musica.paused) musica.play().catch(() => avisar("Seu navegador bloqueou o som."));
  else musica.pause();
});
musica.addEventListener("play", rotuloMusica);
musica.addEventListener("pause", rotuloMusica);

// Desafio: continua a música ao trocar de página (guarda estado e tempo)
window.addEventListener("pagehide", () => {
  sessionStorage.setItem("musica", JSON.stringify({ tocando: !musica.paused, tempo: musica.currentTime }));
});
const estadoMusica = JSON.parse(sessionStorage.getItem("musica") || "null");
if (estadoMusica && estadoMusica.tocando) {
  musica.currentTime = estadoMusica.tempo || 0;
  musica.play().catch(() => {});   // se o navegador bloquear, o usuário clica no botão
}

function tocarSino() {
  const som = new Audio("audio/sino.wav");
  som.volume = 0.4;
  som.play().catch(() => {});
}

/* ==========================================================
   Cliques dos cards (delegação de evento): os cards são criados
   pelo JS, então escutamos o clique no documento e perguntamos
   "qual elemento foi clicado?" com closest().
   ========================================================== */
document.addEventListener("click", (evento) => {
  const comprar = evento.target.closest(".btn-comprar");
  const detalhes = evento.target.closest("[data-detalhes]");
  const ampliar = evento.target.closest("[data-lightbox]");
  const mais = evento.target.closest("[data-mais]");
  const menos = evento.target.closest("[data-menos]");

  if (comprar) {
    adicionarAoCarrinho(Number(comprar.dataset.id));
    tocarSino();
    avisar("Produto adicionado ao carrinho");
  } else if (mais) alterarQuantidade(Number(mais.dataset.mais), 1);
  else if (menos) alterarQuantidade(Number(menos.dataset.menos), -1);
  else if (detalhes) abrirModal(Number(detalhes.dataset.detalhes));
  else if (ampliar) abrirLightbox(ampliar);
});

/* ==========================================================
   RECURSO 10 · Modal de detalhes e lightbox da galeria
   ========================================================== */
const modal = $("#modal");
function abrirModal(id) {
  const p = produtos.find(prod => prod.id === id);
  $("#modal-img").src = p.imagem;
  $("#modal-img").alt = p.nome;
  $("#modal-cat").textContent = p.categoria;
  $("#modal-nome").textContent = p.nome;
  $("#modal-desc").textContent = p.descricao;
  $("#modal-preco").textContent = formatarPreco(p.preco);
  $("#modal-comprar").dataset.id = p.id;
  modal.classList.add("aberta");
}
const lightbox = $("#lightbox");
function abrirLightbox(botao) {
  $("#lightbox-img").src = botao.dataset.lightbox;
  $("#lightbox-img").alt = botao.querySelector("img").alt;
  $("#lightbox-legenda").textContent = botao.querySelector("img").alt;
  lightbox.classList.add("aberta");
}
// Fechar: botão ×, clique no fundo escuro ou tecla Esc
[modal, lightbox].forEach(janela => {
  janela.addEventListener("click", (e) => {
    if (e.target === janela || e.target.closest(".fechar") || e.target.closest("#modal-comprar")) janela.classList.remove("aberta");
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { modal.classList.remove("aberta"); lightbox.classList.remove("aberta"); abrirPainel(false); }
});

/* ==========================================================
   RECURSO 1 · Slideshow (só a classe "ativo" muda)
   ========================================================== */
const slides = $$(".slide");
if (slides.length) {
  const areaPontos = $(".pontos");
  let atual = 0;
  let pausado = false;

  // Um botão (bolinha) para cada slide, criado com laço
  slides.forEach((_, i) => {
    const bolinha = document.createElement("button");
    bolinha.setAttribute("aria-label", `Ir para o slide ${i + 1}`);
    bolinha.addEventListener("click", () => mostrarSlide(i));
    areaPontos.appendChild(bolinha);
  });
  const pontos = $$("button", areaPontos);

  function mostrarSlide(indice) {
    slides.forEach(s => s.classList.remove("ativo"));
    pontos.forEach(b => b.classList.remove("ativo"));
    atual = (indice + slides.length) % slides.length;   // volta ao início/fim
    slides[atual].classList.add("ativo");
    pontos[atual].classList.add("ativo");
  }
  $("#proximo").addEventListener("click", () => mostrarSlide(atual + 1));
  $("#anterior").addEventListener("click", () => mostrarSlide(atual - 1));
  $(".slideshow").addEventListener("mouseenter", () => pausado = true);
  $(".slideshow").addEventListener("mouseleave", () => pausado = false);
  setInterval(() => { if (!pausado) mostrarSlide(atual + 1); }, 5000);   // troca a cada 5 s
  mostrarSlide(0);
}

/* ==========================================================
   RECURSO 2 · Parallax em JavaScript (camadas com velocidades)
   ========================================================== */
const camadas = $$("[data-velocidade]");
if (camadas.length) {
  let esperando = false;
  function moverCamadas() {
    camadas.forEach(camada => {
      const faixa = camada.parentElement.getBoundingClientRect();
      // quanto o centro da faixa está distante do centro da tela (0 = faixa no meio)
      const desvio = (faixa.top + faixa.height / 2) - innerHeight / 2;
      // velocidades diferentes por camada criam a sensação de profundidade
      camada.style.transform = `translateY(${-desvio * camada.dataset.velocidade}px)`;
    });
    esperando = false;
  }
  window.addEventListener("scroll", () => {
    if (esperando) return;                 // limita a 1 atualização por quadro
    esperando = true;
    requestAnimationFrame(moverCamadas);
  }, { passive: true });
  moverCamadas();
}

/* ==========================================================
   RECURSO 7 · Contagem regressiva até o Natal
   ========================================================== */
const contagens = $$("[data-contagem]");
function atualizarContagem() {
  const agora = new Date();
  let natal = new Date(agora.getFullYear(), 11, 25);   // mês 11 = dezembro!
  if (agora > natal) natal = new Date(agora.getFullYear() + 1, 11, 25);
  const falta = natal - agora;                           // milissegundos
  const valores = [
    ["dias", Math.floor(falta / 86400000)],
    ["horas", Math.floor(falta / 3600000) % 24],
    ["min", Math.floor(falta / 60000) % 60],
    ["seg", Math.floor(falta / 1000) % 60]
  ];
  contagens.forEach(el => {
    el.innerHTML = valores.map(([nome, v]) => `<div><strong>${String(v).padStart(2, "0")}</strong>${nome}</div>`).join("");
  });
}
if (contagens.length) { atualizarContagem(); setInterval(atualizarContagem, 1000); }

/* ==========================================================
   RECURSO 8 · Validação do formulário de contato
   ========================================================== */
const formulario = $("#form-contato");
if (formulario) {
  const regras = {
    nome: (v) => v.length < 3 ? "Digite seu nome (mínimo 3 letras)." : "",
    email: (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Digite um e-mail válido, como nome@exemplo.com." : "",
    assunto: (v) => v === "" ? "Escolha um assunto." : "",
    texto: (v) => v.length < 10 ? "A mensagem precisa ter pelo menos 10 caracteres." : ""
  };
  const mensagem = $("#mensagem-form");

  function validarCampo(id) {
    const campo = document.getElementById(id);
    const erro = regras[id](campo.value.trim());
    campo.closest(".campo").classList.toggle("invalido", erro !== "");
    campo.setAttribute("aria-invalid", String(erro !== ""));
    campo.closest(".campo").querySelector(".erro").textContent = erro;
    return erro === "";
  }
  Object.keys(regras).forEach(id => {
    document.getElementById(id).addEventListener("blur", () => validarCampo(id));
    document.getElementById(id).addEventListener("input", () => { if (campoComErro(id)) validarCampo(id); });
  });
  function campoComErro(id) { return document.getElementById(id).closest(".campo").classList.contains("invalido"); }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();                     // impede a página de recarregar
    const tudoOk = Object.keys(regras).map(validarCampo).every(Boolean);  // valida todos
    if (tudoOk) {
      const nome = $("#nome").value.trim().split(" ")[0];
      mensagem.textContent = `Obrigado, ${nome}! Sua mensagem foi enviada. Responderemos em breve.`;
      mensagem.className = "sucesso";
      formulario.reset();
      tocarSino();
    } else {
      mensagem.className = "";
      $(".invalido input, .invalido select, .invalido textarea").focus();
    }
  });
}

/* ==========================================================
   RECURSO 9 · Menu responsivo (hambúrguer)
   ========================================================== */
const botaoMenu = $(".btn-menu");
const menu = $(".menu");
botaoMenu.addEventListener("click", () => {
  const aberto = menu.classList.toggle("aberto");
  botaoMenu.setAttribute("aria-expanded", String(aberto));
});

/* ==========================================================
   RECURSO 11 · Efeito de neve (canvas)
   ========================================================== */
const tela = $("#neve");
if (tela && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const ctx = tela.getContext("2d");
  let flocos = [];
  function ajustarTela() {
    tela.width = innerWidth; tela.height = innerHeight;
    const quantidade = Math.min(110, Math.floor(innerWidth / 12));   // menos flocos no celular
    flocos = Array.from({ length: quantidade }, () => novoFloco(true));
  }
  function novoFloco(aleatorioY) {
    return { x: Math.random() * innerWidth, y: aleatorioY ? Math.random() * innerHeight : -10,
             r: Math.random() * 3 + 1, v: Math.random() * 1 + 0.4, d: Math.random() * Math.PI * 2 };
  }
  function nevar() {
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    flocos.forEach(f => {
      f.y += f.v; f.d += 0.01; f.x += Math.sin(f.d) * 0.5;     // cai e balança
      if (f.y > tela.height + 10) Object.assign(f, novoFloco(false));
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    });
    requestAnimationFrame(nevar);
  }
  ajustarTela(); nevar();
  addEventListener("resize", ajustarTela);
}

/* ==========================================================
   RECURSO 12 · Modo claro / "Noite de Natal" (salvo no localStorage)
   ========================================================== */
const botaoTema = $("#btn-tema");
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $(".rotulo", botaoTema).textContent = tema === "noite" ? "Modo dia" : "Noite de Natal";
  $("use", botaoTema).setAttribute("href", tema === "noite" ? "#i-sol" : "#i-lua");
}
aplicarTema(lerSalvo("tema", "dia"));
botaoTema.addEventListener("click", () => {
  const novo = document.documentElement.dataset.tema === "noite" ? "dia" : "noite";
  salvar("tema", novo);
  aplicarTema(novo);
});

/* ==========================================================
   RECURSO 14 · Botão "voltar ao topo"
   ========================================================== */
const botaoTopo = $("#topo");
window.addEventListener("scroll", () => {
  botaoTopo.style.display = window.scrollY > 400 ? "block" : "none";
}, { passive: true });
botaoTopo.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

/* ==========================================================
   Foto de reserva: se a imagem de um produto ainda não existir,
   mostramos img/produtos/sem-foto.jpg (o evento "error" não borbulha,
   por isso escutamos na fase de captura: true).
   ========================================================== */
document.addEventListener("error", (evento) => {
  const img = evento.target;
  if (img.tagName === "IMG" && !img.dataset.reserva) {
    img.dataset.reserva = "sim";            // evita loop infinito se a reserva também faltar
    img.src = "img/produtos/sem-foto.jpg";
  }
}, true);
