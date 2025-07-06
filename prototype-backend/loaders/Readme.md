## Load using `caiso_loader.py`

### 1. Prerequisites

- Get the document from here [DATA](https://cosmicglobaltech.sharepoint.com/Shared%20Documents/Forms/AllItems.aspx?amp=&id=%2FShared%20Documents%2FPrototype%2FFormatted%20data%20for%20loader&viewid=6c3c2e8a%2Dc9c5%2D42d5%2D8841%2Dad1b5602a564)

place the file in the `root` directory of the project.

### 2. Load the data

- Run the following command to load the data

```bash
docker compose exec server bash
```

```bash
./manage.py shell
```

```python
from loaders import caiso_loader

caiso_loader.load_all_data(
    "interconnection.csv",
    "subst.json",
    True,
    "policy_portfolio.csv",
    True,
    "constraint.csv")
```
