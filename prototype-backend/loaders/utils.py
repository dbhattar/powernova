import re

from enum import Enum


class ConsoleColors(str, Enum):
    SUCCESS = "\033[92m"
    WARNING = "\033[93m"
    ENDC = "\033[0m"


def print_warning(message: str):
    print(f"{ConsoleColors.WARNING.value} {message} {ConsoleColors.ENDC.value}")


def print_success(message: str):
    print(f"{ConsoleColors.SUCCESS.value} {message} {ConsoleColors.ENDC.value}")


def remove_sub_from_string(input_string):
    if not isinstance(input_string, str):
        print("Input must be a string", input_string)
        return input_string
    result = re.sub(r"SUB", "", input_string, flags=re.IGNORECASE)
    return result.strip()
