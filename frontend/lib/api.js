import axios from "axios";
import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const invoiceAPI = {
  async uploadInvoice(file) {
    const formData = new FormData();
    formData.append("invoice", file);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await axios.post(
      `${API_URL}/api/invoices/process`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    return response.data;
  },

  async getInvoices() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await axios.get(`${API_URL}/api/invoices`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    return response.data;
  },

  async deleteInvoice(id) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await axios.delete(`${API_URL}/api/invoices/${id}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    return response.data;
  },
};
