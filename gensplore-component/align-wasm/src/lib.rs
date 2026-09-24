use nextclade::align::align::{align_aa, align_nuc};
use nextclade::align::gap_open::get_gap_open_close_scores_flat;
use nextclade::align::params::{AlignPairwiseParams, AlignPairwiseParamsOptional};
use nextclade::align::seed_match::CodonSpacedIndex;
use nextclade::alphabet::aa::{from_aa_seq, to_aa_seq};
use nextclade::alphabet::nuc::{from_nuc_seq, to_nuc_seq};
use wasm_bindgen::prelude::*;

fn js_error(error: impl std::fmt::Display) -> JsError {
  JsError::new(&error.to_string())
}

/// Nextclade's alignment parameters as its CLI resolves them: the preset, then the
/// overrides in `params_json`, which is a pathogen.json `alignmentParams` object
/// (camelCase keys; empty for Nextclade's defaults). Queries under Nextclade's
/// 100-base minimum are allowed unless `minLength` says otherwise: here any fragment
/// the seeds can place is a legitimate comparison.
fn alignment_params(params_json: &str) -> Result<AlignPairwiseParams, JsError> {
  let json = if params_json.trim().is_empty() { "{}" } else { params_json };
  let overrides: AlignPairwiseParamsOptional =
    serde_json::from_str(json).map_err(|error| js_error(format!("Invalid alignment parameters: {error}")))?;
  let mut params = AlignPairwiseParams::from_preset(overrides.alignment_preset.unwrap_or_default()).map_err(js_error)?;
  params.min_length = 1;
  params.merge_opt(overrides);
  params.validate().map_err(|error| js_error(format!("Invalid alignment parameters: {error:#}")))?;
  Ok(params)
}

/// Aligns `query` to `reference` with Nextclade's seeded, banded aligner and returns
/// the aligned reference and query joined by a newline. Terminal gaps are free, so
/// unsequenced ends appear as leading and trailing query gaps.
///
/// `cds_segments` holds (CDS id, 0-based start, exclusive end, strand ±1) quadruples,
/// segments of one CDS adjacent and in transcript order. They make gap openings cheaper
/// between codons than within them, as Nextclade does with a dataset's annotation.
#[wasm_bindgen]
pub fn align(reference: &str, query: &str, cds_segments: &[i32], params_json: &str) -> Result<String, JsError> {
  let ref_seq = to_nuc_seq(reference).map_err(js_error)?;
  let qry_seq = to_nuc_seq(query).map_err(js_error)?;
  let params = alignment_params(params_json)?;
  let gap_open_close = codon_aware_gap_scores(&ref_seq, cds_segments, &params);
  let seed_index = CodonSpacedIndex::from_sequence(&ref_seq);
  let alignment = align_nuc(0, "", &qry_seq, &ref_seq, &seed_index, &gap_open_close, &params)
    .map_err(|error| js_error(format!("{error:#}")))?;
  Ok(format!("{}\n{}", from_nuc_seq(&alignment.ref_seq), from_nuc_seq(&alignment.qry_seq)))
}

/// Aligns peptide `query` to `reference` with Nextclade's banded amino-acid aligner and
/// returns the aligned reference and query joined by a newline. As in Nextclade's
/// `translate_cds`, the band comes from the CDS's nucleotide alignment rather than
/// seeds: `band_width` and `mean_shift` follow `calculate_aa_alignment_params`.
/// Callers trim unsequenced terminal residues first, so terminal gaps are penalized.
#[wasm_bindgen]
pub fn align_peptides(reference: &str, query: &str, band_width: usize, mean_shift: i32, params_json: &str) -> Result<String, JsError> {
  let ref_seq = to_aa_seq(reference).map_err(js_error)?;
  let qry_seq = to_aa_seq(query).map_err(js_error)?;
  let params = AlignPairwiseParams {
    left_terminal_gaps_free: false,
    right_terminal_gaps_free: false,
    ..alignment_params(params_json)?
  };
  // Nextclade scores peptide gap openings flat (codon awareness is nucleotide-only).
  let gap_open_close = vec![params.penalty_gap_open; ref_seq.len() + 2];
  let alignment = align_aa(&qry_seq, &ref_seq, &gap_open_close, &params, band_width, mean_shift);
  Ok(format!("{}\n{}", from_aa_seq(&alignment.ref_seq), from_aa_seq(&alignment.qry_seq)))
}

// Mirrors nextclade::align::gap_open::get_gap_open_close_scores_codon_aware, which takes
// a GeneMap; building one means Nextclade's GFF3 parser, which grows the module tenfold.
fn codon_aware_gap_scores(ref_seq: &[nextclade::alphabet::nuc::Nuc], cds_segments: &[i32], params: &AlignPairwiseParams) -> Vec<i32> {
  let mut scores = get_gap_open_close_scores_flat(ref_seq, params);
  let (mut cds, mut cds_pos) = (None, 0usize);
  for segment in cds_segments.chunks_exact(4) {
    if cds != Some(segment[0]) {
      cds = Some(segment[0]);
      cds_pos = 0;
    }
    let start = usize::try_from(segment[1]).unwrap_or(0).min(ref_seq.len());
    let end = usize::try_from(segment[2]).unwrap_or(0).clamp(start, ref_seq.len());
    let reverse = segment[3] < 0;
    let codon_start = if reverse { 2 } else { 0 };
    let positions: Box<dyn Iterator<Item = usize>> = if reverse { Box::new((start..end).rev()) } else { Box::new(start..end) };
    for position in positions {
      scores[position] = if cds_pos % 3 == codon_start { params.penalty_gap_open_in_frame } else { params.penalty_gap_open_out_of_frame };
      cds_pos += 1;
    }
  }
  scores
}
