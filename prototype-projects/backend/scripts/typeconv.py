import typesense
import os

TYPESENSE_HOST=os.environ['TYPESENSE_HOST']
TYPESENSE_PORT=os.environ['TYPESENSE_PORT']
TYPESENSE_PROTOCOL=os.environ['TYPESENSE_PROTOCOL']
TYPESENSE_API_KEY=os.environ['TYPESENSE_API_KEY']
OPENAI_API_KEY=os.environ['OPENAI_API_KEY']

typesenseClient = typesense.Client({
    'api_key': TYPESENSE_API_KEY,
    'nodes': [{
        'host': TYPESENSE_HOST,
        'port': TYPESENSE_PORT,
        'protocol': TYPESENSE_PROTOCOL
    }],
    'connection_timeout_seconds': 2
})

# https://typesense.org/docs/28.0/api/conversational-search-rag.html
# curl "http://localhost:8108/collections" \
#        -X POST \
#        -H "Content-Type: application/json" \
#        -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
#        -d '{
#         "name": "conversation_store",
#         "fields": [
#             {
#                 "name": "conversation_id",
#                 "type": "string"
#             },
#             {
#                 "name": "model_id",
#                 "type": "string"
#             },
#             {
#                 "name": "timestamp",
#                 "type": "int32"
#             },
#             {
#                 "name": "role",
#                 "type": "string",
#                 "index": false
#             },
#             {
#                 "name": "message",
#                 "type": "string",
#                 "index": false
#             }
#         ]
#     }'

conversation_schema = {
    "name": "conversation_store",
    "fields": [
        {
            "name": "conversation_id",
            "type": "string"
        },
        {
            "name": "model_id",
            "type": "string"
        },
        {
            "name": "timestamp",
            "type": "int32"
        },
        {
            "name": "role",
            "type": "string",
            "optional": True,
            "index": False,
        },
        {
            "name": "message",
            "type": "string",
            "optional": True,
            "index": False
        }
    ]
}

typesenseClient.collections.create(conversation_schema)

# curl 'http://localhost:8108/conversations/models' \
#   -X POST \
#   -H 'Content-Type: application/json' \
#   -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
#   -d '{
#         "id": "conv-model-1",
#         "model_name": "openai/gpt-3.5-turbo",
#         "history_collection": "conversation_store",
#         "api_key": "OPENAI_API_KEY",
#         "system_prompt": "You are an assistant for question-answering. You can only make conversations based on the provided context. If a response cannot be formed strictly using the provided context, politely say you do not have knowledge about that topic.",        
#         "max_bytes": 16384
#       }'

conv_model_schema = {
    "id": "powernova_conversation_model",
    "model_name": "openai/gpt-4.1-2025-04-14",
    "history_collection": "conversation_store",
    "api_key": OPENAI_API_KEY,
    "system_prompt": "You are an assistant for question-answering. You can only make conversations based on the provided context. If a response cannot be formed strictly using the provided context, politely say you do not have knowledge about that topic.",        
    "max_bytes": 16384
}

conv_model = typesenseClient.conversations_models.create(conv_model_schema)

# {
#   "api_key": "sk-7K**********************************************",
#   "id": "conv-model-1",
#   "max_bytes": 16384,
#   "model_name": "openai/gpt-3.5-turbo",
#   "history_collection": "conversation_store",
#   "system_prompt": "You are an assistant for question-answering. You can only make conversations based on the provided context. If a response cannot be formed strictly using the provided context, politely say you do not have knowledge about that topic."
# }


# curl 'http://localhost:8108/multi_search?q=can+you+suggest+an+action+series&conversation=true&conversation_model_id=conv-model-1' \
#         -X POST \
#         -H "Content-Type: application/json" \
#         -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
#         -d '{
#               "searches": [
#                 {
#                   "collection": "tv_shows",
#                   "query_by": "embedding",
#                   "exclude_fields": "embedding"
#                 }
#               ]
#             }'

search_requests = {
  'searches': [
    {
      'collection': 'projects',
      'q': 'find solar projects in ERCOT and PJM',
      'query_by': 'embedding',
      'exclude_fields': 'embedding'
    }
  ]
}

result = typesenseClient.multi_search.perform(search_requests)

# {
#   "conversation": {
#     "answer": "I would suggest \"Starship Salvage\", a sci-fi action series set in a post-war galaxy where a crew of salvagers faces dangers and ethical dilemmas while trying to rebuild.",
#     "conversation_history": {
#       "conversation": [
#         {
#           "user": "can you suggest an action series"
#         },
#         {
#           "assistant": "I would suggest \"Starship Salvage\", a sci-fi action series set in a post-war galaxy where a crew of salvagers faces dangers and ethical dilemmas while trying to rebuild."
#         }
#       ],
#       "id": "771aa307-b445-4987-b100-090c00a13f1b",
#       "last_updated": 1694962465,
#       "ttl": 86400
#     },
#     "conversation_id": "771aa307-b445-4987-b100-090c00a13f1b",
#     "query": "can you suggest an action series"
#   },
#   "results": [
#     {
#       "facet_counts": [],
#       "found": 10,
#       "hits": [
#         ...
#       ],
#       "out_of": 47,
#       "page": 1,
#       "request_params": {
#         "collection_name": "tv_shows",
#         "per_page": 10,
#         "q": "can you suggest an action series"
#       },
#       "search_cutoff": false,
#       "search_time_ms": 3908
#     }
#   ]
# }

