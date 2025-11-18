"""
Azure Blob Storage service
Handles uploading documents to Azure Blob Storage
"""
import os
import logging
from typing import Optional, Tuple
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient, ContentSettings
from azure.core.exceptions import ResourceExistsError, AzureError
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)


class AzureStorageService:
    """
    Service for interacting with Azure Blob Storage
    """
    
    def __init__(self):
        """Initialize Azure Storage client"""
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "powernova-documents")
        
        if not self.connection_string:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not set. Azure storage will not work.")
            self.blob_service_client = None
            return
            
        try:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                self.connection_string
            )
            # Ensure container exists
            self._ensure_container_exists()
        except Exception as e:
            logger.error(f"Failed to initialize Azure Storage: {e}")
            self.blob_service_client = None
    
    def _ensure_container_exists(self):
        """Create container if it doesn't exist"""
        if not self.blob_service_client:
            return
            
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
            if not container_client.exists():
                container_client = self.blob_service_client.create_container(self.container_name)
                logger.info(f"Created container: {self.container_name}")
        except ResourceExistsError:
            logger.debug(f"Container {self.container_name} already exists")
        except Exception as e:
            logger.error(f"Error ensuring container exists: {e}")
    
    def _generate_blob_path(self, url: str, file_extension: str, job_id: int) -> str:
        """
        Generate a unique blob path for a document
        
        Args:
            url: Original URL of the document
            file_extension: File extension (pdf, html, etc.)
            job_id: Crawl job ID
            
        Returns:
            Blob path in format: job_{job_id}/{hash}.{extension}
        """
        # Create hash of URL for unique filename
        url_hash = hashlib.md5(url.encode()).hexdigest()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Organize by job ID
        blob_path = f"job_{job_id}/{url_hash}_{timestamp}.{file_extension}"
        return blob_path
    
    def upload_document(
        self, 
        content: bytes, 
        url: str, 
        file_extension: str, 
        job_id: int,
        content_type: Optional[str] = None
    ) -> Tuple[str, str, int]:
        """
        Upload a document to Azure Blob Storage
        
        Args:
            content: Document content as bytes
            url: Original URL of the document
            file_extension: File extension
            job_id: Crawl job ID
            content_type: MIME type (e.g., 'application/pdf', 'text/html')
            
        Returns:
            Tuple of (blob_path, blob_url, file_size)
            
        Raises:
            Exception: If upload fails
        """
        if not self.blob_service_client:
            raise Exception("Azure Storage not configured")
        
        # Generate blob path
        blob_path = self._generate_blob_path(url, file_extension, job_id)
        
        # Determine content type
        if not content_type:
            content_type = self._get_content_type(file_extension)
        
        try:
            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_path
            )
            
            # Upload with content settings
            content_settings = ContentSettings(content_type=content_type)
            blob_client.upload_blob(
                content,
                overwrite=True,
                content_settings=content_settings
            )
            
            # Get the blob URL
            blob_url = blob_client.url
            file_size = len(content)
            
            logger.info(f"Uploaded document to Azure: {blob_path} ({file_size} bytes)")
            return blob_path, blob_url, file_size
            
        except AzureError as e:
            logger.error(f"Failed to upload to Azure Storage: {e}")
            raise Exception(f"Azure upload failed: {str(e)}")
    
    def delete_document(self, blob_path: str) -> bool:
        """
        Delete a document from Azure Blob Storage
        
        Args:
            blob_path: Path to the blob
            
        Returns:
            True if deleted successfully, False otherwise
        """
        if not self.blob_service_client:
            logger.warning("Azure Storage not configured, cannot delete")
            return False
        
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_path
            )
            blob_client.delete_blob()
            logger.info(f"Deleted blob: {blob_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete blob {blob_path}: {e}")
            return False
    
    def download_document(self, blob_path: str) -> Optional[bytes]:
        """
        Download a document from Azure Blob Storage
        
        Args:
            blob_path: Path to the blob
            
        Returns:
            Document content as bytes, or None if failed
        """
        if not self.blob_service_client:
            logger.warning("Azure Storage not configured")
            return None
        
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_path
            )
            download_stream = blob_client.download_blob()
            return download_stream.readall()
        except Exception as e:
            logger.error(f"Failed to download blob {blob_path}: {e}")
            return None
    
    def _get_content_type(self, file_extension: str) -> str:
        """
        Get MIME type for file extension
        
        Args:
            file_extension: File extension (without dot)
            
        Returns:
            MIME type string
        """
        content_types = {
            "pdf": "application/pdf",
            "html": "text/html",
            "htm": "text/html",
            "txt": "text/plain",
            "md": "text/markdown",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "doc": "application/msword",
            "json": "application/json",
            "xml": "application/xml"
        }
        return content_types.get(file_extension.lower(), "application/octet-stream")


# Singleton instance
_storage_service = None

def get_storage_service() -> AzureStorageService:
    """Get singleton instance of AzureStorageService"""
    global _storage_service
    if _storage_service is None:
        _storage_service = AzureStorageService()
    return _storage_service
