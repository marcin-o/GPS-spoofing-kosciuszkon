# GPS Spoofing Detection

> Honeywell Kościuszkon 2026 — Theme 2
> Author: Piotr Papiurek, Product Security Architect
> Date: May 9, 2026

## Problem Context

### Strategic vulnerability of critical infrastructure
GPS spoofing exposes how deeply modern economies rely on satellite navigation for aviation, maritime transport, energy grids, and financial systems — making it a high-value target for state and non-state actors.

### Hybrid warfare and gray-zone operations
Spoofing is increasingly used as a non-kinetic tool in geopolitical conflicts, allowing actors to disrupt navigation, create confusion, or assert control without crossing thresholds that would trigger conventional military responses.

### AI/ML as a defensive enabler
Machine learning-based detection systems represent a shift toward adaptive, intelligence-driven defense mechanisms that can operate in real time and scale across infrastructures.

## Dataset Selection, Validation, and Exploratory Analysis

### Dataset Identification and Selection
Identify candidate datasets and justify the choice based on content, size, and operational coverage.

### Data Quality Checks
Perform quality checks to find missing values and inconsistencies ensuring data reliability.

### Exploratory Data Analysis (EDA)
Use visualizations like time-series plots and histograms to illustrate normal and spoofed signal behavior.

## Feature Engineering and Method Selection

### Feature Engineering Fundamentals
Transform raw GPS data into meaningful features using statistical measures and temporal differences to detect anomalies.

### Detection Method Selection
Choose detection methods such as supervised classifiers, unsupervised anomaly detection, or rule-based approaches.

### Assumptions and Limitations
Acknowledge method limitations like noise sensitivity, reliance on labeled data, and challenges with unseen scenarios.

## Implementation Pipeline and Evaluation of Results

### Processing Pipeline Overview
Outline the pipeline: data ingestion, preprocessing, feature extraction, model training, and evaluation steps.

### Data Separation Importance
Properly separate training and testing data to prevent biased results and ensure valid evaluation.

### Evaluation Metrics Used
Use metrics like detection rate, false positive rate, precision, recall, and confusion matrices for assessment.

### Results Presentation
Present results clearly with tables or plots, evaluated on unseen data, emphasizing honest and clear reporting.

---

© 2025 Honeywell International Inc. Neither this document nor the information contained herein may be reproduced, used, distributed or disclosed to others without the written consent of Honeywell.
