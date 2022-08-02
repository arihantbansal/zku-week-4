import detectEthereumProvider from "@metamask/detect-provider";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { providers, Contract, utils } from "ethers";
import Head from "next/head";
import { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { Button, FormLabel, Input, Box, Text } from "@chakra-ui/react";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

import { useFormik } from "formik";
import * as Yup from "yup";

export default function Home() {
	const [logs, setLogs] = useState("Connect your wallet and greet!");
	const [detectedGreeting, setDetectedGreeting] = useState("");

	const formik = useFormik({
		initialValues: {
			name: "",
			age: "",
			address: "",
		},
		validationSchema: Yup.object({
			name: Yup.string().required("Required"),
			age: Yup.number().required().positive().integer(),
			address: Yup.string().required("Required"),
		}),
		onSubmit: (values) => {
			alert(JSON.stringify(values));
			console.log(JSON.stringify(values));
		},
	});

	useEffect(() => {
		const provider = new providers.JsonRpcProvider("http://localhost:8545");
		const contract = new Contract(
			"0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
			Greeter.abi
		);

		const contractOwner = contract.connect(provider.getSigner());

		contractOwner.on("NewGreeting", (result) => {
			console.log("greeting", utils.parseBytes32String(result));
			setDetectedGreeting(utils.parseBytes32String(result));
		});
	}, [logs]);

	async function greet() {
		setLogs("Creating your Semaphore identity...");

		const provider = (await detectEthereumProvider()) as any;

		await provider.request({ method: "eth_requestAccounts" });

		const ethersProvider = new providers.Web3Provider(provider);
		const signer = ethersProvider.getSigner();
		const message = await signer.signMessage(
			"Sign this message to create your identity!"
		);

		const identity = new ZkIdentity(Strategy.MESSAGE, message);
		const identityCommitment = identity.genIdentityCommitment();
		const identityCommitments = await (
			await fetch("./identityCommitments.json")
		).json();

		const merkleProof = generateMerkleProof(
			20,
			BigInt(0),
			identityCommitments,
			identityCommitment
		);

		setLogs("Creating your Semaphore proof...");

		const greeting = "Hello world";

		const witness = Semaphore.genWitness(
			identity.getTrapdoor(),
			identity.getNullifier(),
			merkleProof,
			merkleProof.root,
			greeting
		);

		const { proof, publicSignals } = await Semaphore.genProof(
			witness,
			"./semaphore.wasm",
			"./semaphore_final.zkey"
		);
		const solidityProof = Semaphore.packToSolidityProof(proof);

		const response = await fetch("/api/greet", {
			method: "POST",
			body: JSON.stringify({
				greeting,
				nullifierHash: publicSignals.nullifierHash,
				solidityProof: solidityProof,
			}),
		});

		if (response.status === 500) {
			const errorMessage = await response.text();

			setLogs(errorMessage);
		} else {
			setLogs("Your anonymous greeting is onchain :)");
		}
	}

	return (
		<div className={styles.container}>
			<Head>
				<title>Greetings</title>
				<meta
					name="description"
					content="A simple Next.js/Hardhat privacy application with Semaphore."
				/>
				<link rel="icon" href="/favicon.ico" />
			</Head>

			<main className={styles.main}>
				<h1 className={styles.title}>Greetings</h1>

				<p className={styles.description}>
					A simple Next.js/Hardhat privacy application with Semaphore.
				</p>

				<Box>
					<form onSubmit={formik.handleSubmit}>
						<FormLabel htmlFor="name">Name</FormLabel>
						<Input
							id="name"
							name="name"
							type="text"
							onChange={formik.handleChange}
							onBlur={formik.handleBlur}
							value={formik.values.name}
						/>
						{formik.touched.name && formik.errors.name ? (
							<Text color="red">{formik.errors.name}</Text>
						) : null}

						<FormLabel htmlFor="age">Age</FormLabel>
						<Input
							id="age"
							name="age"
							type="text"
							onChange={formik.handleChange}
							onBlur={formik.handleBlur}
							value={formik.values.age}
						/>
						{formik.touched.age && formik.errors.age ? (
							<Text color="red">{formik.errors.age}</Text>
						) : null}

						<FormLabel htmlFor="address">Address</FormLabel>
						<Input
							id="address"
							name="address"
							type="address"
							onChange={formik.handleChange}
							onBlur={formik.handleBlur}
							value={formik.values.address}
						/>
						{formik.touched.address && formik.errors.address ? (
							<Text color="red">{formik.errors.address}</Text>
						) : null}

						<Button type="submit" my="4">
							Submit
						</Button>
					</form>
				</Box>

				<div className={styles.logs}>{logs}</div>

				<Box m="2">
					<Button
						onClick={() => greet()}
						colorScheme="teal"
						variant="outline"
						mx="16"
						my="4"
						size="lg">
						Greet
					</Button>
				</Box>

				{detectedGreeting && (
					<Box my="8">
						<Text>New Greeting Detected!: </Text>
						<Text>{detectedGreeting}</Text>
					</Box>
				)}
			</main>
		</div>
	);
}
