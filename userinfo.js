const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;
const cors = require('cors');

// Load environment variables
require('dotenv').config();
app.use(cors());

const walletRoutes = require('./routes/walletRoutes');
app.use('/wallets', walletRoutes);

//app.use('/api/wallets', walletRoutes);

const { ethers } = require("ethers");
const fs = require("fs");
//const dotenv = require("dotenv");
const abi = JSON.parse(fs.readFileSync("/app/BC-Eth/userdata/abi/CustodialWallet.json")).abi;
const factoryAbi = JSON.parse(fs.readFileSync("/app/BC-Eth/userdata/abi/CustodialWalletFactory.json")).abi;
const TESTUSDC_ABI = require('/app/BC-Eth/userdata/abi/TestUSDC.json').abi;

//const erc20Abi = JSON.parse(fs.readFileSync("abi/ERC20/ERC20.json")).abi;
const INFURA_API_KEY = process.env.INFURA_API_KEY;

// Infura URL for Sepolia
const infuraUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
let owners = {};
let wallets = [];
// Create a provider (read-only connection to the blockchain)
//const provider = new ethers.JsonRpcProvider(infuraUrl);

// Create a wallet instance from the private key
//const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
//const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
//const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
//const signer = new ethers.Wallet("5dd1c2a9fd750bee3cabeb1376428216d1c79e04bef93d4dbbddfeef9e26f340", provider);
//
// Create a provider (read-only connection to the blockchain)
const provider = new ethers.JsonRpcProvider(infuraUrl);
const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY, provider);
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const testUSDC = new ethers.Contract(process.env.TESTUSDC_ADDRESS, TESTUSDC_ABI, signer);
//const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!INFURA_API_KEY || !PRIVATE_KEY ) {
    console.error("Missing environment variables. Please check your .env file.");
    process.exit(1);
}


// Create a provider (read-only connection to the blockchain)
//const provider = new ethers.JsonRpcProvider(infuraUrl);

// Create a wallet instance from the private key
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const factory = new ethers.Contract(process.env.FACTORY_ADDRESS, factoryAbi, wallet);

// PostgreSQL connection setup
const pool = new Pool({
  user: 'swifthackdbuser',
  host: 'localhost',
  database: 'swifthackdb',
  password: 'swifthackdbuser1234',
  port: 5432, // default PostgreSQL port
});

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stablecoin Transaction APIs',
      version: '1.0.0',
      description: 'API documentation for stablecoin transaction services',
    },
  },
  apis: ['./userinfo.js'], // Adjust path if routes are in different files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec),express.json());
app.use(express.json());

// Function to fetch user by ID
const getUserById = async (userId) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

// Route to fetch user by ID
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user details by user ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User data retrieved successfully
 *       500:
 *         description: Failed to fetch user data
 */
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const users = await getUserById(userId);
    res.json({
      message: 'User data available',
      data: users.length ? users : []
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
});

// 🔍 API: Fetch best bridge support for given LP currency
/**
 * @swagger
 * /lp/{currency}:
 *   get:
 *     summary: Get best bridge support info for LP currency
 *     parameters:
 *       - name: currency
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bridge support data returned
 *       500:
 *         description: Failed to fetch LP currency data
 */
app.get('/lpcurrency/:currency', async (req, res) => {
  const lpCurrency = req.params.currency;

  try {
    const result = await pool.query(
      `SELECT bridge_support, cost, speed FROM lp_currency_info
       WHERE lp_currency = $1
       ORDER BY cost ASC, speed ASC LIMIT 1`,
      [lpCurrency]
    );

    res.json({
      message: `Best bridge support info for ${lpCurrency}`,
      data: result.rows.length ? result.rows[0] : null
    });
  } catch (err) {
    console.error('Error fetching LP currency info:', err);
    res.status(500).json({ message: 'Failed to fetch LP currency data' });
  }
});

// 📄 API: Retrieve all LP currency records
/**
 * @swagger
 * /lp/all:
 *   get:
 *     summary: Retrieve all LP currency records
 *     responses:
 *       200:
 *         description: All LP currency data returned
 *       500:
 *         description: Failed to fetch data
 */
app.get('/lp/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lp_currency_info');
    res.json({
      message: 'All LP currency records',
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching all LP currency data:', err);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

// 📄 API: validate-payee wallet
/**
 * @swagger
 * /validate-payee:
 *   get:
 *     summary: Validate payee wallet using query parameters
 *     parameters:
 *       - name: wallet_address
 *         in: query
 *         schema:
 *           type: string
 *       - name: beneficiary_name
 *         in: query
 *         schema:
 *           type: string
 *       - name: beneficiary_id
 *         in: query
 *         schema:
 *           type: string
 *       - name: vasp_registration_id
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching records found or none
 *       400:
 *         description: No query parameters provided
 *       500:
 *         description: Internal server error
 */
app.get('/validate-payee', async (req, res) => {
  const {
    wallet_address,
    beneficiary_name,
    beneficiary_id,
    vasp_registration_id
  } = req.query;

  try {
    // Construct dynamic query conditions
    const conditions = [];
    const values = [];

    if (wallet_address) {
      conditions.push('wallet_address = $' + (values.length + 1));
      values.push(wallet_address);
    }
    if (beneficiary_name) {
      conditions.push('beneficiary_name = $' + (values.length + 1));
      values.push(beneficiary_name);
    }
    if (beneficiary_id) {
      conditions.push('beneficiary_id = $' + (values.length + 1));
      values.push(beneficiary_id);
    }
    if (vasp_registration_id) {
      conditions.push('vasp_registration_id = $' + (values.length + 1));
      values.push(vasp_registration_id);
    }

    if (!conditions.length) {
      return res.status(400).json({
        message: 'Please provide at least one query parameter for validation',
        data: null
      });
    }

    const query = `
      SELECT * FROM beneficiary_vasp_wallet_validation
      WHERE ${conditions.join(' OR ')}
    `;

    const result = await pool.query(query, values);

    res.json({
      message: result.rows.length
        ? 'Matching payee records found'
        : 'No matching records',
      data: result.rows
    });
  } catch (err) {
    console.error('Error validating payee:', err);
    res.status(500).json({ message: 'Internal server error', data: null });
  }
});

// 📥 API to insert data
/**
 * @swagger
 * /api/deposit-or-withdrawal:
 *   post:
 *     summary: Insert deposit or withdrawal data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_id:
 *                 type: integer
 *               customer_name:
 *                 type: string
 *               wallet_address:
 *                 type: string
 *               action_performed:
 *                 type: string
 *               stablecoin_currency:
 *                 type: string
 *               amount:
 *                 type: string
 *     responses:
 *       201:
 *         description: Record created successfully
 *       500:
 *         description: Internal server error
 */

app.post('/api/deposit-or-withdrawal', async (req, res) => {
  const {
    customer_id,
    customer_name,
    wallet_address,
    action_performed,
    stablecoin_currency,
    amount,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.deposits_withdrawals (
        customer_id,
        customer_name,
        wallet_address,
        action_performed,
        stablecoin_currency,
        amount
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customer_id, customer_name, wallet_address, action_performed, stablecoin_currency, amount]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 📥 API to insert a transaction
/**
 * @swagger
 * /api/transaction:
 *   post:
 *     summary: Insert a new transaction record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transaction_id:
 *                 type: integer
 *               payer_name:
 *                 type: string
 *               payer_address:
 *                 type: string
 *               payer_bank:
 *                 type: string
 *               stablecoin_type:
 *                 type: string
 *               amount:
 *                 type: string
 *               payee_name:
 *                 type: string
 *               payee_address:
 *                 type: string
 *               payee_bank:
 *                 type: string
 *               transaction_date:
 *                 type: string
 *                 format: date-time
 *               transaction_completion_date:
 *                 type: string
 *                 format: date-time
 *               transaction_status:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *       500:
 *         description: Internal server error
 */

app.post('/api/transaction', async (req, res) => {
  const {
    transaction_id,
    payer_name,
    payer_address,
    payer_bank,
    stablecoin_type,
    amount,
    payee_name,
    payee_address,
    payee_bank,
    transaction_date,
    transaction_completion_date,
    transaction_status
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.transactions (
        transaction_id,
        payer_name,
        payer_address,
        payer_bank,
        stablecoin_type,
        amount,
        payee_name,
        payee_address,
        payee_bank,
        transaction_date,
        transaction_completion_date,
        transaction_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        transaction_id,
        payer_name,
        payer_address,
        payer_bank,
        stablecoin_type,
        amount,
        payee_name,
        payee_address,
        payee_bank,
        transaction_date,
        transaction_completion_date,
        transaction_status
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error inserting transaction:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Customer'
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       500:
 *         description: Internal server error
 */
app.post('/api/customers', async (req, res) => {
  const {
    CUST_ID,
    UserName,
    email,
    organization,
    GLEI,
    status,
    wallets,
    last_login
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public."Customers" (
        "CUST_ID", "UserName", email, organization, "GLEI",
        status, wallets, last_login
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [CUST_ID, UserName, email, organization, GLEI, status, wallets, last_login]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting customer:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Retrieve customers with optional filters
 *     parameters:
 *       - name: email
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *       - name: organization
 *         in: query
 *         schema:
 *           type: string
 *       - name: UserName
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customers retrieved
 *       500:
 *         description: Internal server error
 */
app.get('/api/customers', async (req, res) => {
  const filters = req.query;
  const conditions = [];
  const values = [];

  Object.entries(filters).forEach(([key, value], idx) => {
    conditions.push(`"${key}" = $${idx + 1}`);
    values.push(value);
  });

  const query = conditions.length
    ? `SELECT * FROM public."Customers" WHERE ${conditions.join(' AND ')}`
    : `SELECT * FROM public."Customers"`;

  try {
    const result = await pool.query(query, values);
    res.json({
      message: 'Customer data retrieved',
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


/**
 * Create a new wallet and store it in the database.
 */
app.post("/api/wallet/create", async (req, res) => {
    console.log("Creating new wallet with data:", req.body);
  const { walletId,owner,walletAddress, stablecoinCurrency,status, createdBy,createdOn,balance,approvers, approvalsRequired} = req.body;
  try {
    //walletAddress refers to an address temporarily used to create the wallet.
    const tx = await factory.createWallet(walletAddress, approvers, approvalsRequired);
    const receipt = await tx.wait();
    console.log("Wallet creation transaction hash:", receipt.transactionHash);
    console.log("receipt.logs", receipt.logs);

    const iface = factory.interface;
    const event = receipt.logs
        .map(log => {
            try {
                return iface.parseLog(log);
            } catch {
                return null;
            }
    })
    .find(parsed => parsed && parsed.name === "WalletCreated");
    // check if the event is successfull and thenstore the wallet in the database for the owner which can be viewed by admin as well as the owner
    if (!event) {
        return res.status(500).json({ error: "WalletCreated event not found" });
	}else{
        const wallet = event.args.wallet;
        await pool.query(
        "INSERT INTO wallets (wallet_id,owner,wallet_address, stablecoin_currency,status, created_by,created_on,balance,approvers, approvals_required) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [walletId,owner,wallet, stablecoinCurrency,status, createdBy,createdOn,balance,approvers, approvalsRequired]
        );
        console.log("Wallet stored in database:", wallet);
        res.json({ wallet });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all wallets for administrator
app.get('/api/wallet', async (req, res) => {
    console.log("Fetching all wallets for admin");

    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM wallets order by created_on desc');
      client.release();
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers.', error: error.message });
    }
  });

// routes code

app.post('/api/owner/create', async (req, res) => {
  const wallet = ethers.Wallet.createRandom();
  owners[wallet.address] = wallet.privateKey;
  res.json({ address: wallet.address, privateKey: wallet.privateKey });
});

/**
 * create a new custodial wallet
 * @param {string} ownerAddress - the address of the owner
 * @returns {string} walletAddress - the address of the new wallet
 */
app.post('/api/createCustodialWallet', async (req, res) => {
	//NOTE: Need to pass username, ownerAdress and cointype(currency),vaspUser
  const { user_name,ownerAddress,coinType,vaspUser } = req.body;
  if (!ethers.isAddress(ownerAddress)) return res.status(400).json({ error: 'Invalid address' });
  const tx = await factory.createWallet(process.env.TESTUSDC_ADDRESS, ownerAddress);
  const receipt = await tx.wait();
  const event = receipt.logs.map(log => {
    try { return factory.interface.parseLog(log); } catch { return null; }
  }).find(e => e && e.name === 'WalletCreated');
    const walletAddress = event.args.wallet;
    console.log(`New Custodial wallet created: ${walletAddress}`);
    wallets.push(walletAddress);
	//TODO insert into DB username, owneraddress, cointype , custodial wallet(walletAddress), tnxdate, txhash-- done
    const query = `
      INSERT INTO custodial_wallets (username, owner_address, coin_type, vasp_user, wallet_address,  tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const values = [user_name, ownerAddress, coinType, vaspUser, walletAddress,  tx.hash];
    await pool.query(query, values);
    res.json({ wallet: walletAddress });
});
//TODO build an get API to create custodailwallet API as above- done

app.get('/api/getCustodialWallet', async (req, res) => {
  const { username, ownerAddress } = req.query;

  let baseQuery = 'SELECT * FROM custodial_wallets';
  const filters = [];
  const values = [];

  if (username) {
    filters.push('username = $' + (values.length + 1));
    values.push(username);
  }

  if (ownerAddress) {
    filters.push('owner_address = $' + (values.length + 1));
    values.push(ownerAddress);
  }

  if (filters.length > 0) {
    baseQuery += ' WHERE ' + filters.join(' AND ');
  }

  try {
    const { rows } = await pool.query(baseQuery, values);
    res.json({ wallets: rows });
  } catch (err) {
    console.error('Error fetching custodial wallets:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/mint', async (req, res) => {
  try {

    const { user_name,toAddress, amount,coinType } = req.body;
    console.log(`Minting ${amount} USDC to ${toAddress}`);
    const mintAmount = ethers.parseUnits(amount.toString(), 6);
    const tx = await testUSDC.mint(toAddress, mintAmount);
    await tx.wait();
	  //TODO insert into DB user_name,toAddress, amount,coinType, tnxDate & tnxhash (tx.hash) -- done
    const query = `
      INSERT INTO mint_transactions (username, to_address, amount, coin_type,  tx_hash)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const values = [user_name, toAddress, amount, coinType,  tx.hash];
    await pool.query(query, values);
    res.json({ txHash: tx.hash });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});
/**
 * utility function to create a new owner address
 * need to store this address in database per owner
 */

 app.post('/api/wallet/createOwnerAddress', async (req, res) => {
    //write logic to check if owner exists in database
    // if not, create a new owner address
    // for now, we will just create a random address
    const { user_name } = req.body;
    const ownerwalletAddress = ethers.Wallet.createRandom();
    console.log("Address:", ownerwalletAddress.address);
    console.log("Private Key:", ownerwalletAddress.privateKey); // store securely!
	 //TODO insert into DB address, privateky,username-- done
    // Insert into DB
    const query = `
      INSERT INTO owner_addresses (username, address, private_key)
      VALUES ($1, $2, $3)
      ON CONFLICT (address) DO NOTHING
    `;
    const values = [user_name, ownerwalletAddress.address,ownerwalletAddress.privateKey];
    await pool.query(query, values);
    res.json({
        address: ownerwalletAddress.address,
        privateKey: ownerwalletAddress.privateKey
      });
    return ownerwalletAddress.address;
  });

//TODO Add an API to return address and private key for a given username--done
//
//
app.get('/api/wallet/getOwnerAddress', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const query = `
      SELECT address, private_key 
      FROM owner_addresses 
      WHERE username = $1
    `;
    const values = [username];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No address found for that username' });
    }

    const { address, private_key } = rows[0];
    res.json({ address, privateKey: private_key });
  } catch (err) {
    console.error('Error fetching owner address:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


 app.post('/api/wallet/approve', async (req, res) => {
    const { user_name,ownerPrivateKey,amount } = req.body;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    console.log('inside Approve');
    //const ownerWallet = new ethers.Wallet("0x3d68e6433a8f01ba16ba2eec3f56db4f51cfcf352388b4926b79d4cc6f463562", provider);
    // const token = new ethers.Contract(process.env.TESTUSDC_ADDRESS, TESTUSDC_ABI, signer);
    // const tx = await token.approve(signer.address, ethers.parseUnits(amount, 6));
    // await tx.wait();
    // console.log("Approved:", tx.hash);
    // res.json({ txHash: tx.hash });


      // 🔑  Load owner signer
      const OWNER_PRIVATE_KEY = ownerPrivateKey;
  const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
	 console.log('after ownerWallet');
  const ownerAddress = await ownerWallet.getAddress();
	 console.log('after ownerAddress');
    const VASP_ADDRESS = signer.address; // VASP address is the signer address
  // 🎯  Load TestUSDC contract
  const token = new ethers.Contract(process.env.TESTUSDC_ADDRESS, TESTUSDC_ABI, ownerWallet);

  console.log(`Approving VASP (${VASP_ADDRESS}) to spend USDC from Owner (${ownerAddress})...`);

  // 📤  Send approval
  const tx = await token.approve(VASP_ADDRESS, ethers.parseUnits(amount, 6));
  await tx.wait();

  // 🔎  Check allowance
  const allowance = await token.allowance(ownerAddress, VASP_ADDRESS);
  console.log("✅  Approval complete. Allowance:", ethers.formatUnits(allowance, 6));
	 //TODO insert into DB username,date of transaction , amount & txhash -- done
  // After successful approval and getting tx.hash
  const insertQuery = `
  INSERT INTO wallet_approvals (user_name, amount, tx_hash)
  VALUES ($1, $2, $3)
` ;
  const insertValues = [user_name, amount, tx.hash];

  try {
  await pool.query(insertQuery, insertValues);
  console.log('Approval record inserted into DB');
  } catch (dbErr) {
   console.error('Failed to insert approval record:', dbErr);
  }

  res.json({ txHash: tx.hash });
  });


 app.post('/api/transferFrom', async (req, res) => {
	 //NOTE: All APIs should send user_name as unique for request body
  const { user_name,fromAddress, toAddress, amount } = req.body;
  const parsed = ethers.parseUnits(amount.toString(), 6);
  var allowance = await testUSDC.allowance(fromAddress, signer.address);
  var balance = await testUSDC.balanceOf(fromAddress);
  console.log(`Transferring ${amount} USDC from ${fromAddress} to ${toAddress}`)
  console.log(`Allowance: ${ethers.formatUnits(allowance, 6)}, Balance: ${ethers.formatUnits(balance, 6)}`);
  if (allowance < parsed) return res.status(400).json({ error: 'Insufficient allowance' });
  if (balance < parsed) return res.status(400).json({ error: 'Insufficient balance' });
  const tx = await testUSDC.transferFrom(fromAddress, toAddress, parsed);
  await tx.wait();
  allowance = await testUSDC.allowance(fromAddress, signer.address);
  balance = await testUSDC.balanceOf(fromAddress);
  console.log(`Transferred ${amount} USDC from ${fromAddress} to ${toAddress}`)
  console.log(`Allowance: ${ethers.formatUnits(allowance, 6)}, Balance: ${ethers.formatUnits(balance, 6)}`);
	 //TODO insert into DB user_name,fromAddress(owner address), toAddress (custodial Address), amount, allowance, balance, txhash, date-- done
  const insertQuery = `
  INSERT INTO amount_transfers (
    user_name, from_address, to_address, amount,
    allowance, balance, tx_hash
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
`;
 const insertValues = [
  user_name,
  fromAddress,
  toAddress,
  amount,
  ethers.formatUnits(allowance, 6),
  ethers.formatUnits(balance, 6),
  tx.hash
 ];

 try {
  await pool.query(insertQuery, insertValues);
  console.log('Transfer record inserted into amount_transfers');
 } catch (dbErr) {
  console.error('DB insert error:', dbErr);
 }

  res.json({ txHash: tx.hash });
});

app.get('/api/:walletAddress/balance', async (req, res) => {
  console.log(':walletAddress',req.params.walletAddress);
  const balance = await testUSDC.balanceOf(req.params.walletAddress);
  res.json({ balance: ethers.formatUnits(balance, 6) });
});
// routes code -end

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
