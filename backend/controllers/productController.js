import { Product } from '../models/Product.js';

// Get all products
export async function getAllProducts(req, res) {
  try {
    const { search, category, lowStock } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { hsn: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (lowStock === 'true') {
      filter.stock = { $lte: 5 };
    }

    const products = await Product.find(filter).sort({ productName: 1 });
    return res.json({ success: true, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Get single product
export async function getProductById(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Create product
export async function createProduct(req, res) {
  try {
    const {
      productName,
      hsn = '540752',
      category = 'General',
      wholesaleRate = 0,
      gstPercent = 5,
      profitPercent = 20,
      sellingPrice,
      stock = 0,
      unit = 'Pcs',
      barcode = '',
      dateAdded
    } = req.body;

    if (!productName || !productName.trim()) {
      return res.status(400).json({ success: false, error: 'Product Name is required' });
    }

    const rate = Number(wholesaleRate) || 0;
    const gst = Number(gstPercent) || 5;
    const cost = rate + (rate * (gst / 100));
    const profit = Number(profitPercent) || 20;
    const calculatedSelling = sellingPrice ? Number(sellingPrice) : Math.ceil(cost + (cost * (profit / 100)));

    const newProduct = await Product.create({
      productName: productName.trim(),
      hsn: hsn.trim(),
      category: category.trim(),
      wholesaleRate: rate,
      gstPercent: gst,
      costAfterGST: Number(cost.toFixed(2)),
      profitPercent: profit,
      sellingPrice: calculatedSelling,
      stock: Number(stock) || 0,
      unit: unit.trim(),
      barcode: barcode.trim(),
      dateAdded: dateAdded || new Date().toISOString().split('T')[0]
    });

    return res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Update product
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.productName) {
      updateData.productName = updateData.productName.trim();
    }

    if (updateData.wholesaleRate !== undefined) {
      const rate = Number(updateData.wholesaleRate) || 0;
      const gst = Number(updateData.gstPercent) || 5;
      const cost = rate + (rate * (gst / 100));
      updateData.costAfterGST = Number(cost.toFixed(2));
      
      if (!updateData.sellingPrice && updateData.profitPercent) {
        const profit = Number(updateData.profitPercent) || 20;
        updateData.sellingPrice = Math.ceil(cost + (cost * (profit / 100)));
      }
    }

    const updated = await Product.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    return res.json({ success: true, product: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Delete product
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted successfully', id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Bulk clear / bulk add products
export async function clearAllProducts(req, res) {
  try {
    await Product.deleteMany({});
    return res.json({ success: true, message: 'All products cleared' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
