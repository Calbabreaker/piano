import { Piano } from "components/Piano";
import Head from "next/head";

const Index = () => {
    return (
        <main>
            <Head>
                <title>Play Piano!</title>
            </Head>
            <Piano startNote="A0" endNote="C8" />
        </main>
    );
};

export default Index;
