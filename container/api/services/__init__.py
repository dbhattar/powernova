"""
Services package
Contains business logic for crawling, document processing, and storage
"""
from .azure_storage import get_storage_service, AzureStorageService
from .document_processor import get_document_processor, DocumentProcessor
from .crawler import run_crawler, WebCrawler

__all__ = [
    "get_storage_service",
    "AzureStorageService",
    "get_document_processor",
    "DocumentProcessor",
    "run_crawler",
    "WebCrawler"
]
