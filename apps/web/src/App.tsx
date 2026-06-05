import { Box, Container, CssBaseline, Typography } from '@mui/material'

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ py: 6 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            securePDF
          </Typography>
          <Typography color="text.secondary">
            ローカルファーストの PDF 整理・変換ツール。作業エリアは Milestone 2 で実装します。
          </Typography>
        </Box>
      </Container>
    </>
  )
}
