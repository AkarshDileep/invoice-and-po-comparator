from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import google.generativeai as genai
from django.conf import settings
import os
from pypdf import PdfReader
import re

# Configure the Gemini API key
GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class ListModelsView(APIView):
    def get(self, request, *args, **kwargs):
        if not GEMINI_API_KEY:
            return Response({"error": "Gemini API key not configured. Please set it in your settings.py file."}, status=status.HTTP_400_BAD_REQUEST)
        
        models = [m.name for m in genai.list_models()]
        return Response(models, status=status.HTTP_200_OK)

def extract_text_from_file(file):
    try:
        if file.name.endswith('.pdf'):
            reader = PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        else:
            return file.read().decode('utf-8')
    except Exception as e:
        return f"Error reading file: {e}"

import re

def get_invoice_details_from_gemini(text, is_po=False):
    if not GEMINI_API_KEY:
        return {"error": "Gemini API key not configured."}

    try:
        model = genai.GenerativeModel('gemini-2.5-pro')
        if is_po:
            prompt = f"You are an expert in extracting information from invoices and purchase orders. Extract the following details and return them as a JSON object: po_number, vendor, items (as a list of strings), and total_amount. Here is the text: {text}"
        else:
            prompt = f"You are an expert in extracting information from invoices and purchase orders. Extract the following details and return them as a JSON object: invoice_number, vendor, items (as a list of strings), and total_amount. Here is the text: {text}"
        
        response = model.generate_content(prompt)
        
        # Extract the JSON part of the response
        match = re.search(r'```json\n(.*?)\n```', response.text, re.DOTALL)
        if match:
            return match.group(1)
        else:
            return response.text # Fallback to the original text if no match

    except Exception as e:
        return {"error": str(e)}


class InvoiceComparisonView(APIView):
    def post(self, request, *args, **kwargs):
        if not GEMINI_API_KEY:
            return Response({"error": "Gemini API key not configured. Please set it in your settings.py file."}, status=status.HTTP_400_BAD_REQUEST)

        invoices = [request.FILES.get(f'invoice{i}') for i in range(1, 4)]
        pos = [request.FILES.get(f'po{i}') for i in range(1, 4)]

        invoices = [i for i in invoices if i]
        pos = [p for p in pos if p]

        if not invoices or not pos:
            return Response({"error": "Please upload at least one invoice and one purchase order."}, status=status.HTTP_400_BAD_REQUEST)

        results = []

        for i, invoice_file in enumerate(invoices):
            po_file = pos[i] if i < len(pos) else None

            if not po_file:
                continue

            invoice_text = extract_text_from_file(invoice_file)
            po_text = extract_text_from_file(po_file)

            if invoice_text.startswith('Error reading file:'):
                return Response({"error": invoice_text}, status=status.HTTP_400_BAD_REQUEST)
            if po_text.startswith('Error reading file:'):
                return Response({"error": po_text}, status=status.HTTP_400_BAD_REQUEST)

            invoice_data_str = get_invoice_details_from_gemini(invoice_text, is_po=False)
            po_data_str = get_invoice_details_from_gemini(po_text, is_po=True)

            if isinstance(invoice_data_str, dict) and 'error' in invoice_data_str:
                return Response({"error": f"Error processing invoice: {invoice_data_str['error']}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            if isinstance(po_data_str, dict) and 'error' in po_data_str:
                return Response({"error": f"Error processing purchase order: {po_data_str['error']}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            try:
                import json
                invoice_data = json.loads(invoice_data_str)
                po_data = json.loads(po_data_str)
            except (json.JSONDecodeError, TypeError):
                return Response({"error": "Could not parse data from Gemini."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Improved comparison logic
            vendor_match = invoice_data.get('vendor', '').strip().lower() == po_data.get('vendor', '').strip().lower()
            
            try:
                invoice_total = float(invoice_data.get('total_amount', 0))
                po_total = float(po_data.get('total_amount', 0))
                total_amount_match = invoice_total == po_total
            except (ValueError, TypeError):
                invoice_total = 0
                po_total = 0
                total_amount_match = False

            invoice_items = [str(item).lower() for item in invoice_data.get('items', [])]
            po_items = [str(item).lower() for item in po_data.get('items', [])]
            
            # Flexible item matching
            unmatched_invoice_items = []
            temp_po_items = list(po_items)
            for item in invoice_items:
                found = False
                for po_item in temp_po_items:
                    if item in po_item:
                        found = True
                        temp_po_items.remove(po_item)
                        break
                if not found:
                    unmatched_invoice_items.append(item)
            
            items_match = not unmatched_invoice_items and len(invoice_items) == len(po_items)

            if vendor_match and total_amount_match and items_match:
                results.append({
                    "match": True,
                    "invoice_number": invoice_data.get('invoice_number'),
                    "po_number": po_data.get('po_number'),
                    "vendor": invoice_data.get('vendor'),
                    "total_amount": invoice_total,
                    "details": "✓ Perfect Match!",
                    "status": "APPROVED - No issues found!"
                })
            else:
                mismatches = []
                if not vendor_match:
                    mismatches.append(f"Vendor mismatch: Invoice ('{invoice_data.get('vendor')}') vs PO ('{po_data.get('vendor')}')")
                if not total_amount_match:
                    price_diff = abs(invoice_total - po_total)
                    mismatches.append(f"Price difference of ${price_diff:.2f}!")
                if not items_match:
                    mismatches.append(f"Items do not match. Unmatched invoice items: {unmatched_invoice_items}")
                
                results.append({
                    "match": False,
                    "invoice_number": invoice_data.get('invoice_number'),
                    "po_number": po_data.get('po_number'),
                    "vendor_match": vendor_match,
                    "total_amount_match": total_amount_match,
                    "items_match": items_match,
                    "mismatches": mismatches,
                    "details": "✗ Mismatch",
                    "status": f"NEEDS REVIEW - {mismatches[0]}"
                })

        return Response(results, status=status.HTTP_200_OK)