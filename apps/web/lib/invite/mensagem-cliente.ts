/**
 * Mensagem pronta que o terapeuta cola no WhatsApp do cliente junto com o link
 * de convite. Usada pelos DOIS botões de copiar do InviteLinkDialog e pelo
 * "Compartilhar no WhatsApp" — os três levam exatamente este texto.
 *
 * Vive fora do componente por um motivo: assim dá pra travar num teste que a
 * ORDEM DOS OLHOS dita aqui é a mesma de SEQUENCE (lib/capture/sequence.ts).
 * Se alguém inverter a sequência de captura, o teste quebra e obriga a
 * reescrever esta frase — em vez de a mensagem seguir mentindo pro cliente.
 *
 * Tom de marca (Bob): não-médico, sóbrio, DIRETA. O cliente já sabe que vai
 * fotografar (o terapeuta conversou com ele antes), então nada de "propor" ou
 * explicar o produto — é o link mais a instrução prática.
 *
 * Sem asteriscos de negrito do WhatsApp: a mensagem também vai por e-mail e
 * SMS, onde eles aparecem crus. CAIXA ALTA destaca em qualquer canal.
 */
export function buildClientMessage(url: string): string {
  return `Olá. Aqui está o seu link para a leitura da íris.

Abra no celular, num lugar bem iluminado, e siga o passo a passo. São 6 fotos e leva poucos minutos.

A ORDEM DOS OLHOS IMPORTA:
1ª, 2ª e 3ª fotos — olho ESQUERDO
4ª, 5ª e 6ª fotos — olho DIREITO

Comece pelo olho ESQUERDO. O app mostra em cada foto qual é o olho da vez — confira antes de fotografar. Se a ordem trocar, a leitura sai trocada.

A imagem é apagada assim que o relatório fica pronto, em no máximo 24 horas. O link é só seu e fica disponível por 7 dias:

${url}`
}
