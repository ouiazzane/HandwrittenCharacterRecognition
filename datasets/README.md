# Dataset files

Dataset files are not included in this repository. Download the **EMNIST** dataset in CSV format from the [Kaggle EMNIST dataset](https://www.kaggle.com/datasets/crawford/emnist) or use the [official EMNIST dataset page](https://www.nist.gov/itl/products-and-services/emnist-dataset).

The training pipeline expects the relevant CSV image files and their class-mapping text files, including names such as:

- `emnist-mnist-train.csv` and `emnist-mnist-test.csv`
- `emnist-balanced-train.csv` and `emnist-balanced-test.csv`
- The corresponding `emnist-mnist-mapping.txt` and `emnist-balanced-mapping.txt` files supplied with the dataset

Place the files in this structure:

```text
datasets/
├── mnist/
│   ├── emnist-mnist-train.csv
│   ├── emnist-mnist-test.csv
│   └── emnist-mnist-mapping.txt
└── emnist/
    ├── emnist-balanced-train.csv
    ├── emnist-balanced-test.csv
    └── emnist-balanced-mapping.txt
```

EMNIST images are stored transposed relative to the orientation expected by the model. The training data loader must transpose the images before training and evaluation. Do not commit the downloaded CSV files or generated dataset caches; Git ignores dataset contents except for this README.
