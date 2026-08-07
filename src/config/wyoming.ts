export interface WyomingConfig {
  mailingAddress: {
    recipient: string;
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  /** Includes instruction to verify current amount at the SOS website. */
  feeNote: string;
  statuteRef: string;
  processingTimeNote: string;
  sosFormsUrl: string;
  sosBusinessSearchUrl: string;
  /** ISO date — displayed in UI as "Verified [date]" */
  lastVerified: string;
}

const wyomingConfig: WyomingConfig = {
  mailingAddress: {
    recipient: "Wyoming Secretary of State",
    street: "Herschler Building East, Suite 101, 122 W 25th St",
    city: "Cheyenne",
    state: "WY",
    zip: "82002-0020",
  },
  feeNote:
    "A filing fee is required. Verify the current amount at wyomingsos.gov before mailing — fees are subject to change.",
  statuteRef: "W.S. 17-29-701",
  processingTimeNote:
    "Processing typically takes approximately one week. The stamped confirmation copy is returned by mail to the registered agent or the address on the form.",
  sosFormsUrl: "https://sos.wyo.gov/Forms/Business/Dissolution.aspx",
  sosBusinessSearchUrl: "https://sos.wyo.gov/Business/BusinessSearch.aspx",
  lastVerified: "2026-08-06",
};

export default wyomingConfig;
