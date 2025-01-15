import React, { useState } from 'react';
import { connect } from 'react-redux';
import Button from '@gen3/ui-component/dist/components/Button';
import { headers } from "../configs";
import AnalysisWorkspace from "./workflow/AnalysisWorkspace";

const DataAnalysisPage = () => {
  const app = ['BamDownloadApp', 'CDave', 'CohortComparisonApp', 'CohortLevelMAF', 'GeneExpression',
   'MutationFrequencyApp', 'OncoMatrix', 'ProteinPaintApp', 'scRNAseq', 'SequenceReadApp', 'SetOperations'];
  return (
    <div style={{ textAlign: 'left', padding: '50px' }}>
      "import data analysis page here"
      <AnalysisWorkspace
        app={app && app.length > 0 ? app.toString() : undefined}
      />
    </div>
  );
};

export default DataAnalysisPage;

