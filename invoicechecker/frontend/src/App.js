import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import './App.css';

function App() {
  const [invoices, setInvoices] = useState([null, null, null]);
  const [pos, setPos] = useState([null, null, null]);
  const [invoicePreviews, setInvoicePreviews] = useState([null, null, null]);
  const [poPreviews, setPoPreviews] = useState([null, null, null]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resultsRef = useRef(null);

  useEffect(() => {
    if (results.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results]);

  const handleFileChange = (e, index, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'invoice') {
        const newInvoices = [...invoices];
        newInvoices[index] = file;
        setInvoices(newInvoices);

        const newInvoicePreviews = [...invoicePreviews];
        newInvoicePreviews[index] = reader.result;
        setInvoicePreviews(newInvoicePreviews);
      } else {
        const newPos = [...pos];
        newPos[index] = file;
        setPos(newPos);

        const newPoPreviews = [...poPreviews];
        newPoPreviews[index] = reader.result;
        setPoPreviews(newPoPreviews);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    const formData = new FormData();
    invoices.forEach((invoice, index) => {
      if (invoice) {
        formData.append(`invoice${index + 1}`, invoice);
      }
    });
    pos.forEach((po, index) => {
      if (po) {
        formData.append(`po${index + 1}`, po);
      }
    });

    try {
      const response = await axios.post('/api/compare/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(response.data);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('An error occurred during comparison. Please try again.');
      }
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="relative z-10 container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">Invoice and PO Comparator</h1>
          <p className="text-lg text-gray-400">Upload your invoices and purchase orders to compare them.</p>
        </header>
        <main>
          <Card className="bg-gray-800 border-gray-700 mb-12">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Upload Files</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold">Invoices</h2>
                    {[0, 1, 2].map(index => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Invoice {index + 1}</label>
                        <input type="file" onChange={(e) => handleFileChange(e, index, 'invoice')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold">Purchase Orders</h2>
                    {[0, 1, 2].map(index => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-400 mb-2">PO {index + 1}</label>
                        <input type="file" onChange={(e) => handleFileChange(e, index, 'po')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <Button type="submit" disabled={loading} size="lg" className="transition-transform transform hover:scale-105 bg-purple-600 hover:bg-purple-700 text-white">
                    {loading ? (
                      <>
                        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Comparing...</span>
                      </>
                    ) : (
                      'Compare'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {(invoicePreviews.some(p => p) || poPreviews.some(p => p)) && (
            <Card className="bg-gray-800 border-gray-700 mb-12">
              <CardHeader>
                <CardTitle className="text-center text-2xl">File Previews</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4">Invoice Previews</h3>
                  {invoicePreviews.map((preview, index) => (
                    preview && <embed key={index} src={preview} type="application/pdf" width="100%" height="400px" className="mb-4"/>
                  ))}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">PO Previews</h3>
                  {poPreviews.map((preview, index) => (
                    preview && <embed key={index} src={preview} type="application/pdf" width="100%" height="400px" className="mb-4"/>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {results.length > 0 && (
            <Card ref={resultsRef} className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-center text-2xl">Comparison Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className={`p-4 rounded-lg ${result.match ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                    <h3 className="font-bold text-lg mb-2">{result.details}</h3>
                    <p className="text-sm text-gray-400 mb-2">Invoice #{result.invoice_number} matches PO #{result.po_number}</p>
                    {result.match ? (
                      <div className="text-sm space-y-1">
                        <p>Vendor matches: {result.vendor} ✓</p>
                        <p>Total amount matches: ${result.total_amount.toFixed(2)} ✓</p>
                        <p>All items match ✓</p>
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        <p>Vendor matches: {result.vendor_match ? '✓' : '✗'}</p>
                        <p>Total amount matches: {result.total_amount_match ? '✓' : '✗'}</p>
                        <p>All items match: {result.items_match ? '✓' : '✗'}</p>
                      </div>
                    )}
                    {result.mismatches && (
                      <div className="mt-2">
                        <h4 className="font-semibold">Mismatches:</h4>
                        <ul className="list-disc list-inside text-sm text-red-400">
                          {result.mismatches.map((mismatch, i) => (
                            <li key={i}>{mismatch}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="font-semibold mt-2">→ Status: {result.status}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
