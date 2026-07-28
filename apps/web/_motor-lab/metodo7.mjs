// MÉTODO SOMÁTICO — 7 movimentos. EXTRAÍDO do proto aprovado
// (relatorio-novo/b6-terapeuta-proto.html). O esqueleto é FIXO; as falas ancoradas
// (movimentos 2, 3, 5, 6 e o micro-passo do 7) vêm do Sonnet via @CAMINHO.
// {CARGA} e {ANTI} são substituídos pela emoção e pelo antídoto do eixo daquele Caminho.
export const METODO7 = [
 {
  "n": 1,
  "cls": "",
  "nome": "Chegar e montar a casa",
  "exp": "Antes de tocar o que pesa: criar segurança, chão no corpo, e um <b>lugar seguro pra onde voltar</b> (o recurso) — <b>ancorado com um gesto</b> (a mão no peito) pra reativá-lo depois. É a rede de proteção de tudo o que vem depois.",
  "cue": "Não avance enquanto essa casa não estiver sentida no corpo.",
  "labs": [],
  "pausa": "— respira —",
  "slot": null,
  "depois": [],
  "fixo": [
   "<p>\"Antes de começar, quero te dizer uma coisa: aqui você não precisa acertar nada, nem chegar a lugar nenhum. É só um tempo seu, com você. Sente os pés no chão, as costas apoiadas, e olha devagar pro lugar onde você está — você está aqui, agora, e aqui é seguro.\"</p><p class=\"pause\">— respira —</p><p>\"Antes da gente olhar o que pesa, acha um lugar dentro de você que está mais tranquilo — uma parte do corpo em paz, uma lembrança boa, ou a sua própria firmeza. Deixa ele por perto: é pra cá que a gente volta.\"</p><p class=\"pause\">— pausa —</p><p>\"Agora coloca a mão no centro do peito e respira ali um instante, deixando essa sensação boa crescer um pouco. Essa é a sua âncora: toda vez que a sua mão voltar pro peito, esse lugar seguro volta junto.\"</p>"
  ],
  "slot7": null
 },
 {
  "n": 2,
  "cls": "carga",
  "nome": "Tocar a {CARGA} no corpo",
  "exp": "Levar a {CARGA} do pensamento pro corpo, <b>aos poucos</b>, em 3 tempos: lembrar a cena → notar no corpo → dar forma. Com a pessoa <b>olhando</b> a emoção, não virando ela.",
  "cue": "\"Você está olhando pra ela; você não é ela.\" Um pouquinho já basta.",
  "labs": [],
  "pausa": "— deixe ela contar a cena —",
  "slot": "s2",
  "depois": [
   {
    "pausa": true,
    "t": "— deixe ela contar a cena —"
   },
   {
    "pausa": false,
    "t": "\"Enquanto lembra dessa cena, tem alguma parte do corpo que te chama a atenção? Um aperto, um arrepio, alguma sensação?\""
   },
   {
    "pausa": true,
    "t": "— dê tempo —"
   },
   {
    "pausa": false,
    "t": "\"E essa sensação, se tivesse um jeito — peso, temperatura, tamanho — qual seria?\""
   }
  ],
  "fixo": null,
  "slot7": null
 },
 {
  "n": 3,
  "cls": "",
  "nome": "Deixar falar",
  "exp": "Dar voz à sensação <b>sem interpretar nem confirmar</b> — o que a pessoa nomeia vale mais que a sua leitura.",
  "cue": "",
  "labs": [],
  "pausa": "— espere —",
  "slot": "s3",
  "depois": [
   {
    "pausa": true,
    "t": "— espere —"
   },
   {
    "pausa": false,
    "t": "\"Tem mais alguma coisa junto?\""
   }
  ],
  "fixo": null,
  "slot7": null
 },
 {
  "n": 4,
  "cls": "carga",
  "nome": "Deixar mover — dar caminho pra completar",
  "exp": "Dar à raiva um caminho pra <b>se mover e terminar</b> o movimento que ficou preso. <b>É aqui que a energia represada volta como força</b> — não é forçar explosão. Ofereça uma das duas portas.",
  "cue": "<b>Deu certo quando o corpo assenta</b> (afrouxou, suspirou, esvaziou) — não pelo tamanho do choro.",
  "labs": [
   "Porta A — a respiração que move",
   "Porta B — a forma que se desfaz"
  ],
  "pausa": "",
  "slot": null,
  "depois": [],
  "fixo": [
   "<span class=\"say-lab\">Porta A — a respiração que move</span><p>\"Leva a respiração até onde a {CARGA} mora. A cada vez que solta o ar, abre um espaço ali, e deixa ela se mover do jeito que precisar — subir, escorrer, sair. Se vier um tremor, um suspiro, um calor, deixa passar.\"</p>",
   "<span class=\"say-lab\">Porta B — a forma que se desfaz</span><p>\"Fica olhando a forma dela — o peso, a cor, a temperatura. Sem forçar, vê ela ir mudando, afrouxando, até começar a se desfazer.\"</p>"
  ],
  "slot7": null
 },
 {
  "n": 5,
  "cls": "recurso",
  "nome": "Voltar pro outro lado",
  "exp": "Voltar pra casa e fazer o <b>vaivém</b> — a pessoa aprende que pode tocar a {CARGA} <b>e voltar</b>. Aqui dá <b>forma</b> ao recurso e junta ele ao lugar seguro (a âncora).",
  "cue": "Vaivém devagar, da {CARGA} pra firmeza e de volta. \"Você tocou <b>e voltou</b> — isso já é força.\"",
  "labs": [],
  "pausa": "— espere —",
  "slot": "s5",
  "depois": [
   {
    "pausa": true,
    "t": "— espere —"
   },
   {
    "pausa": false,
    "t": "\"Que jeito tem essa firmeza — é quente, tem um peso bom, uma cor? Que tamanho?\""
   },
   {
    "pausa": true,
    "t": "— dê forma —"
   },
   {
    "pausa": false,
    "t": "\"Repara se ela fica perto daquele lugar seguro do começo. Coloca a mão no peito e deixa os dois se juntarem.\""
   }
  ],
  "fixo": null,
  "slot7": null
 },
 {
  "n": 6,
  "cls": "sentido",
  "nome": "Colher o sentido",
  "exp": "Amarrar o que o corpo viveu a um <b>novo significado</b> — é o que faz o efeito durar.",
  "cue": "Deixe ela formular. Não entregue a conclusão pronta.",
  "labs": [],
  "pausa": "",
  "slot": "s6",
  "depois": [],
  "fixo": null,
  "slot7": null
 },
 {
  "n": 7,
  "cls": "fechar",
  "nome": "Fechar e passar o bastão",
  "exp": "Trazer a pessoa <b>de volta por inteiro</b> (nunca encerre dentro do material) e amarrar num passo pra sessão.",
  "cue": "",
  "labs": [
   "Fechar",
   "Micro-passo"
  ],
  "pausa": "",
  "slot": null,
  "depois": [],
  "fixo": [
   "<span class=\"say-lab\">Fechar</span><p>\"Vamos voltar por inteiro. Sente os pés, o corpo apoiado, o ar entrando. Olha o lugar de novo. Repara em como você está agora, comparado a quando começamos.\"</p>",
   "<span class=\"say-lab\">Micro-passo</span><p>\"Tem uma coisa pequena, hoje, que você anda engolindo e que já poderia dizer — com calma, no tamanho certo? Leva isso pra nossa sessão.\"</p>"
  ],
  "slot7": "s7"
 }
]
export const CONDUCT = "<span class=\"conduct-lab\">⚠ Carga alta</span><p>É a carga mais forte desta leitura. Vá bem aos poucos e complete o movimento (etapa 4) sem forçar catarse. Se aparecer ferida antiga da infância, acolha e marque pra sessão.</p>"
