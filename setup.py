#!/usr/bin/env python3
"""
ALEJO - Advanced Language and Execution Jarvis Operator
Setup script for installation
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="alejo",
    version="1.0.0",
    author="ALEJO Team",
    author_email="alejo@example.com",
    description="Advanced browser compatibility testing framework with AI capabilities",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/alejo-team/alejo",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.9",
    install_requires=[
        "selenium>=4.0.0",
        "opencv-python>=4.5.0",
        "numpy>=1.20.0",
        "cryptography>=36.0.0",
        "flask>=2.0.0",
        "pyotp>=2.6.0",
        "qrcode>=7.3.0",
    ],
    entry_points={
        "console_scripts": [
            "alejo=alejo.__main__:main",
        ],
    },
)
