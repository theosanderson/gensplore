use nextclade::align::align::align_nuc;
use nextclade::align::gap_open::get_gap_open_close_scores_flat;
use nextclade::align::params::AlignPairwiseParams;
use nextclade::align::seed_match::CodonSpacedIndex;
use nextclade::alphabet::nuc::{from_nuc_seq, to_nuc_seq};
use wasm_bindgen::prelude::*;

fn js_error(error: impl std::fmt::Display) -> JsError {
  JsError::new(&error.to_string())
}

/// Aligns `query` to `reference` with Nextclade's seeded, banded aligner and returns
/// the aligned reference and query joined by a newline. Terminal gaps are free, so
/// unsequenced ends appear as leading and trailing query gaps.
///
/// `cds_segments` holds (CDS id, 0-based start, exclusive end, strand ±1) quadruples,
/// segments of one CDS adjacent and in transcript order. They make gap openings cheaper
/// between codons than within them, as Nextclade does with a dataset's annotation.
#[wasm_bindgen]
pub fn align(reference: &str, query: &str, cds_segments: &[i32]) -> Result<String, JsError> {
  let ref_seq = to_nuc_seq(reference).map_err(js_error)?;
  let qry_seq = to_nuc_seq(query).map_err(js_error)?;
  // Nextclade rejects queries under 100 bases as low quality; here any fragment the
  // seeds can place is a legitimate comparison.
  let params = AlignPairwiseParams { min_length: 1, ..AlignPairwiseParams::default() };
  let gap_open_close = codon_aware_gap_scores(&ref_seq, cds_segments, &params);
  let seed_index = CodonSpacedIndex::from_sequence(&ref_seq);
  let alignment = align_nuc(0, "", &qry_seq, &ref_seq, &seed_index, &gap_open_close, &params)
    .map_err(|error| js_error(format!("{error:#}")))?;
  Ok(format!("{}\n{}", from_nuc_seq(&alignment.ref_seq), from_nuc_seq(&alignment.qry_seq)))
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
