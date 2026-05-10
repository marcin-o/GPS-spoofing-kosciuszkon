use std::path::Path;
use std::time::Instant;

use ndarray::Array2;
use ort::session::Session;
use ort::value::TensorRef;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ModelEntry {
    n_features: usize,
    threshold: f32,
}

#[derive(Debug, Deserialize)]
struct Schema {
    texbat: ModelEntry,
    aissou: ModelEntry,
}

pub struct DualRunner {
    texbat: Session,
    aissou: Session,
    threshold_l1: f32,
    threshold_l2: f32,
    n_features_l1: usize,
    n_features_l2: usize,
}

impl DualRunner {
    pub fn load(assets_dir: &Path) -> anyhow::Result<Self> {
        let schema_str = std::fs::read_to_string(assets_dir.join("model_schema.json"))?;
        let schema: Schema = serde_json::from_str(&schema_str)?;

        let texbat = Session::builder()?
            .commit_from_file(assets_dir.join("texbat_l1.onnx"))?;
        let aissou = Session::builder()?
            .commit_from_file(assets_dir.join("aissou_l2.onnx"))?;

        Ok(Self {
            texbat,
            aissou,
            threshold_l1: schema.texbat.threshold,
            threshold_l2: schema.aissou.threshold,
            n_features_l1: schema.texbat.n_features,
            n_features_l2: schema.aissou.n_features,
        })
    }

    pub fn thresholds(&self) -> (f32, f32) {
        (self.threshold_l1, self.threshold_l2)
    }

    pub fn run(&mut self, l1: &[f32], l2: &[f32]) -> anyhow::Result<(f32, f32, u64)> {
        anyhow::ensure!(
            l1.len() == self.n_features_l1,
            "L1 feature count {} != expected {}",
            l1.len(),
            self.n_features_l1
        );
        anyhow::ensure!(
            l2.len() == self.n_features_l2,
            "L2 feature count {} != expected {}",
            l2.len(),
            self.n_features_l2
        );

        let in_l1 = Array2::from_shape_vec((1, self.n_features_l1), l1.to_vec())?;
        let in_l2 = Array2::from_shape_vec((1, self.n_features_l2), l2.to_vec())?;

        let start = Instant::now();

        let out_l1 = self.texbat.run(ort::inputs!["input" => TensorRef::from_array_view(&in_l1)?])?;
        let out_l2 = self.aissou.run(ort::inputs!["input" => TensorRef::from_array_view(&in_l2)?])?;

        let p_l1 = extract_class1_prob(&out_l1)?;
        let p_l2 = extract_class1_prob(&out_l2)?;

        let elapsed = start.elapsed().as_micros() as u64;
        Ok((p_l1, p_l2, elapsed))
    }
}

/// XGBClassifier exported via skl2onnx with `zipmap=False` produces:
///   outputs[0]: int64 [batch] of predicted labels
///   outputs[1]: float32 [batch, 2] of probabilities
/// We always read the class-1 probability at index 1.
fn extract_class1_prob(outputs: &ort::session::SessionOutputs) -> anyhow::Result<f32> {
    let view = outputs[1].try_extract_array::<f32>()?;
    let shape = view.shape();
    if shape.len() == 2 && shape[1] >= 2 {
        Ok(view[[0, 1]])
    } else if shape.len() == 1 && shape[0] >= 2 {
        Ok(view[[1]])
    } else {
        anyhow::bail!("unexpected probability tensor shape: {:?}", shape)
    }
}
