from django.contrib import messages
from django.http import HttpResponseRedirect
from form_action import extra_button

from core import models
from core.choices import FileExtensionChoices


@extra_button("Add all file extensions")
def add_all_file_extensions(request):
    models.FileExtension.objects.bulk_create(
        [
            models.FileExtension(extension=extension)
            for extension in FileExtensionChoices.values
        ],
        ignore_conflicts=True,
    )
    messages.info(request, "Successfully added all file extensions.")
    return HttpResponseRedirect("/admin/core/appsetting/")
