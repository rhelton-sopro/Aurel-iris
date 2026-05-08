<!-- SOURCE: SPEC.md §6 (linhas 638-660). Frozen contract D-PR1. Qualquer mudança aqui exige edit coordenado em SPEC.md. -->

<client_context>
Nome: {{client_name}}
Idade: {{age}}
Observações do terapeuta: {{therapist_notes}}
Mapa preferido: {{iris_map}}
</client_context>

<features>
{{vision_features_json}}
</features>

<knowledge>
{{rag_chunks_concatenated_with_citations}}
</knowledge>

Gere a leitura iridológica integrativa seguindo a estrutura definida no system prompt.
Lembre-se: cada interpretação deve citar entre colchetes a feature do JSON que a ancora.
