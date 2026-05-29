numList = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
primes = 0
def isPrime(num):
    isPrime = True
    for i in range(2,num):
        if (num%i == 0):
            isPrime = False
    return isPrime
primeList = list(filter(lambda x: (x > 1 and isPrime(x)), numList))

print("No. of primes: ", len(primeList))
print(primeList)