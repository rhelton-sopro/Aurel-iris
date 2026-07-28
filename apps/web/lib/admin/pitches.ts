// Pitches de vendas (founder → terapeuta). Conteúdo estático versionado em git:
// muda raramente e nunca por usuário, então não vale mesa no banco. Fonte editorial
// e registro da auditoria: `Estatégia comercial e mkt/PITCH-DE-VENDAS.md`.
//
// REGRA: `beat` é guia de fala (aparece na tela, NÃO entra no texto copiado).
// Só `texto` é copiado — ver pitchToText().

export type PitchBloco = {
  /** Etiqueta de condução. Fica na tela; nunca vai pro clipboard. */
  beat?: string
  texto: string
}

export type Pitch = {
  slug: string
  titulo: string
  duracao: string
  palavras: number
  /** Onde esse pitch é usado — e o que ele deliberadamente NÃO faz. */
  onde: string
  blocos: PitchBloco[]
}

/** Texto falado, sem as etiquetas de beat. É isto que o botão copia. */
export function pitchToText(p: Pitch): string {
  return p.blocos.map((b) => b.texto).join('\n\n')
}

export const PITCHES: Pitch[] = [
  {
    slug: '30s',
    titulo: '30 segundos',
    duracao: 'o elevador',
    palavras: 95,
    onde: 'DM, apresentação em roda, resposta a “o que você faz?”. Sem preço, sem oferta.',
    blocos: [
      {
        texto: 'Pensa num cliente seu que trava sempre no mesmo ponto.',
      },
      {
        texto:
          'Você faz tudo certo, escuta de verdade — e mesmo assim a sessão acaba e o nó continua ali, na frente dos dois. Não é falha sua: você só tem o que ele consegue te trazer.',
      },
      {
        texto:
          'O Iris Codex entra por outra porta. Você fotografa a íris dele com o seu celular e em minutos recebe escrito quem ele é — e as perguntas pra conduzir a sessão. Sem estudar iridologia, sem anos de curso.',
      },
      {
        texto:
          'A primeira leitura é grátis. Faça na sua própria íris: é o jeito honesto de julgar.',
      },
    ],
  },
  {
    slug: '2min',
    titulo: '2 minutos',
    duracao: 'o pitch de conversa',
    palavras: 350,
    onde: 'Grupo de terapeutas, live, ligação, story falado. É o que mais vai rodar.',
    blocos: [
      {
        beat: 'a cena',
        texto:
          'Você conhece essa sessão. Fez tudo certo: criou o espaço, ganhou a confiança, escutou de verdade. E mesmo assim a conversa não chegou lá. Ele foi embora sem tocar no que importava — e ficou em você aquela sensação de que o nó estava ali o tempo todo, bem na frente dos dois.',
      },
      {
        beat: 'a tese — agora com rosto',
        texto:
          'Eu penso muito nisso. Tudo o que a gente tem pra trabalhar é o que o cliente consegue trazer. E tem uma camada a mais: o que ele conta sobre si foi construído com as mesmas ferramentas que construíram o problema. Ele não mente. A mulher que “é muito forte” está te contando o preço que pagou pra nunca precisar de ninguém. O homem que “leva tudo na esportiva” está te contando onde aprendeu a rir antes de sentir. Quem começa pelo autorrelato começa por dentro da defesa.',
      },
      {
        beat: 'o produto',
        texto:
          'O Iris Codex entra por outra porta. O cliente não responde questionário nenhum. Você fotografa a íris dele ali na sessão, com o seu celular, e em minutos o documento chega escrito sobre aquela pessoa: o temperamento que ele trouxe de nascença, em que idade cada padrão se formou, o que ele repete sem perceber, a força que ele tem e não usa de propósito — porque nunca reparou que era força. E o último bloco não é dele, é seu: as perguntas pra conduzir a devolutiva.',
      },
      {
        beat: 'anti-genérico',
        texto:
          'E não é texto de prateleira. Troque a pessoa e não muda um adjetivo: muda tudo.',
      },
      {
        beat: 'o giro',
        texto:
          'Repara no que isso faz com a conversa. O que está no papel não é o que ele te contou — e ele sabe disso. Então, quando bate, ele não tem como te devolver o crédito. O reconhecimento é dele. É aquele instante em que ele para de te acompanhar e olha pra dentro. Quem trabalha com gente sabe o que muda depois disso.',
      },
      {
        beat: 'prova e limite',
        texto:
          'Uma terapeuta que leu a própria me escreveu: “nunca ninguém me descreveu tão bem em toda a minha vida”. Outra: “isso está revolucionando a terapia”. E eu faço questão do limite: cada achado é hipótese — quem valida é o cliente, na sua frente. É apoio à anamnese, não diagnóstico. O terapeuta é você.',
      },
      {
        beat: 'o passo',
        texto:
          'Você não precisa estudar iridologia pra isso — não são anos de estudo, a leitura vem pronta. Tem uma leitura grátis no cadastro, sem cartão. Faça na sua própria íris antes de fazer na de um cliente: é o único jeito honesto de julgar uma coisa dessas.',
      },
    ],
  },
  {
    slug: '5min',
    titulo: '5 minutos',
    duracao: 'o pitch completo',
    palavras: 840,
    onde: 'Webinar, aula aberta, reunião, vídeo de vendas. O único que menciona preço.',
    blocos: [
      {
        beat: '0:00 — a projeção',
        texto:
          'Antes de eu começar, pensa num cliente seu. Um que trava sempre no mesmo ponto. Guarda ele aí.',
      },
      {
        beat: '0:15 — a cena',
        texto:
          'Você conhece essa sessão. Fez tudo certo: criou o espaço, ganhou a confiança, escutou de verdade. E mesmo assim a conversa não chegou lá. Ele foi embora sem nunca tocar no que importava — sem nem saber que estava ali. E ficou em você a certeza incômoda de que o nó existia o tempo todo, bem na frente dos dois. Não foi falta de técnica. Não foi falta de confiança.',
      },
      {
        beat: '0:45 — o teto',
        texto:
          'Pensa comigo. Tudo o que a gente tem pra trabalhar é o que o cliente consegue trazer. A escuta mais afiada do mundo ainda esbarra nesse teto: o que ele não alcança em si, você não alcança nele. E o que mais importa mora quase sempre justo aí.',
      },
      {
        texto:
          'Mas tem uma camada a mais. O que ele conta sobre si mesmo foi construído com as mesmas ferramentas que construíram o problema. Ele não está mentindo — ele está te dando a versão que precisou montar pra se aguentar. A mulher que “é muito forte” está te contando o preço que pagou pra nunca precisar de ninguém. O homem que “leva tudo na esportiva” está te contando onde aprendeu a rir antes de sentir. A descrição não é o mapa do terreno. Ela é parte do terreno.',
      },
      {
        texto:
          'Quer dizer: quando a gente começa pelo autorrelato, começa por dentro do sistema que a pessoa montou pra se proteger. E às vezes leva meses pra sair de lá.',
      },
      {
        texto: 'Foi por isso que eu fui atrás de uma segunda porta.',
      },
      {
        beat: '1:40 — o que é',
        texto:
          'O Iris Codex lê a íris. O cliente não responde questionário nenhum — não tem “como você se descreve”, não tem escala de 1 a 5. Você fotografa a íris dele ali na sessão, com o celular que já está no seu bolso. São seis fotos, três ângulos de cada olho, e o próprio app te guia até o enquadramento ficar bom. Nada de iridoscópio, nada de estúdio. Você informa só o básico — nome, idade, a queixa que ele trouxe — e em minutos o documento chega escrito sobre aquela pessoa.',
      },
      {
        beat: '2:20 — o que vem escrito',
        texto:
          'Um retrato de quem ele é: o temperamento que trouxe de nascença, o jeito de sentir o mundo que ele sempre teve sem nunca ter reparado. Uma linha do tempo emocional, com as idades aproximadas em que cada coisa se formou. O que ele herdou sem escolher, de gente que às vezes nem conheceu. O que ele repete sem perceber que está escolhendo. As forças que ele subestima. O que ele aprendeu a proteger cedo — e a defesa que montou em volta disso.',
      },
      {
        texto:
          'Tudo em linguagem de cliente. Nenhuma palavra de iridologia: sem fibra, sem anel, sem zona. E nada de doença — emoção e comportamento, do começo ao fim.',
      },
      {
        beat: '3:05 — a parte que é sua',
        texto:
          'E o último bloco não é do cliente. É seu: as perguntas pra conduzir a devolutiva. Elas não miram a cabeça, miram o corpo. Uma delas é assim: “onde no corpo isso vive — agora, enquanto eu leio isso pra você? Garganta que aperta, peito que fecha, estômago que pesa?” Repara que ela não pede explicação. Ela pede presença. Porque o que a boca não diz, o corpo guarda inteiro.',
      },
      {
        texto:
          'E isso importa porque o produto não é o relatório. O produto é a devolutiva — a sessão que você conduz. O relatório é a matéria-prima. Ele te coloca no campo profundo já na primeira fala; não te substitui em nenhum minuto dela.',
      },
      {
        beat: '3:45 — o giro',
        texto:
          'Repara no que isso faz com a conversa. O que está no papel não é o que ele te contou — e ele sabe disso. Então, quando bate, não tem como ele te devolver o crédito: não foi você repetindo a fala dele, porque ele não falou. O reconhecimento é dele, sozinho. É aquele instante em que ele para de te acompanhar e olha pra dentro. Quem trabalha com gente sabe o que muda depois disso.',
      },
      {
        beat: '4:05 — a desconfiança, que é justa',
        texto:
          'Se você está aí pensando “isso é horóscopo caro”, a pergunta é certa. Eu faria ela também.',
      },
      {
        texto:
          'Duas coisas. A primeira: há mais de um século a tradição iridológica observa e cataloga o que o desenho da íris revela do temperamento e do comportamento — Jensen, Johnson, Battello, Lindemann. O Iris Codex herdou esse acúmulo. Foi treinado nessa tradição pra reconhecer os sinais daquela íris e partir deles pra escrever, nunca de um texto pronto. Troque a pessoa e não muda um adjetivo: muda tudo.',
      },
      {
        texto:
          'A segunda: eu não escondo o limite. Cada achado é hipótese — quem valida é o cliente, na sua frente. Por mais assertiva que a leitura seja, ela pode errar. É apoio à anamnese, não diagnóstico, e não substitui avaliação médica. O terapeuta é você.',
      },
      {
        texto:
          'E não sou só eu dizendo. Uma terapeuta leu a própria e me escreveu: “nunca ninguém me descreveu tão bem em toda a minha vida”. Outra: “quanta precisão — comecei minha vida adulta ainda criança, de fato”. Elas não estavam sendo gentis comigo. Estavam se reconhecendo.',
      },
      {
        beat: '4:45 — o tempo e as objeções que sobram',
        texto:
          'Repara no tempo que isso te devolve. Não são anos de estudo pra aprender a ler uma íris — essa parte a máquina faz. E não são cinco sessões até chegar no que importa: você começa lá dentro na primeira. Você revisa, ajusta e dá a palavra final; a interpretação e a relação com o cliente são sempre suas.',
      },
      {
        texto:
          'Sobre a foto: a íris é o dado mais íntimo que existe, então ela tem hora pra ir embora. Assim que o relatório é gerado e conferido, a imagem é apagada — e em qualquer caso, no máximo em 24 horas. Você é o controlador dos dados, em conformidade com a LGPD, e a imagem do seu cliente nunca treina nenhuma IA. O que permanece é a leitura.',
      },
      {
        texto:
          'E não tem assinatura. Você compra suas leituras antes de usar — uma avulsa por R$ 99,70, ou um pacote, onde a leitura chega a R$ 39,70. Créditos válidos por 12 meses, PIX ou cartão. Não há fatura correndo, não há nada a cancelar.',
      },
      {
        beat: '5:20 — o convite',
        texto:
          'Aquele cliente em que você pensou lá no começo: é nele que eu queria que você testasse. Mas antes dele, faça na sua própria íris. Tem uma leitura grátis no cadastro, sem cartão. É o único jeito honesto de julgar uma coisa dessas — porque aí quem sabe se o que está escrito é verdade é você.',
      },
    ],
  },
]
